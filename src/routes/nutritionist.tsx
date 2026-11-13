import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { auth, db } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { useOperatorAuth } from "@/lib/use-operator-auth";
import { loginOperator } from "@/lib/operator-auth-action";
import { ChangeOperatorPassword } from "@/components/messhub/ChangeOperatorPassword";
import { doc, getDoc, serverTimestamp, writeBatch, collection, getDocs, query, where } from "firebase/firestore";
import { 
  MESSES, 
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  type MessId, 
  type NutritionDishItem,
  type MicronutrientProfile
} from "@/lib/messhub";
import { 
  HeartPulse, 
  LogOut, 
  Plus, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Flame, 
  Menu, 
  X, 
  ChevronRight,
  Info,
  Calendar,
  ChefHat,
  Table,
  LayoutList,
  CheckSquare,
  Square
} from "lucide-react";

export const Route = createFileRoute("/nutritionist")({
  head: () => ({
    meta: [
      { title: "Nutritionist Studio Matrix — VITMESS" },
      { name: "description", content: "Master Excel-style nutritional studio matrix with safe multi-mess sync." }
    ],
  }),
  component: NutritionistPortalPage,
});

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;

const POPULAR_REGIONS = [
  "Tamil Nadu Style",
  "Punjabi Style",
  "Kerala Style",
  "Rajasthani Style",
  "Bengali Style",
  "Andhra / Telangana Style",
  "Maharashtrian Style",
  "Malwa / Central Indian",
  "Gujarati Style",
  "Kashmiri Style",
  "Mughlai / Awadhi",
  "Goan Style",
  "Indo-Chinese",
  "Continental"
];

export interface StudioDishItem extends NutritionDishItem {
  servingSize?: string;
  specialTag?: string;
  recipe?: {
    ingredients?: string;
    method?: string;
  };
}

export type StudioDayMenu = {
  breakfast: StudioDishItem[];
  lunch: StudioDishItem[];
  snacks: StudioDishItem[];
  dinner: StudioDishItem[];
};

// 🧹 Simplified cleanup helper using direct ID generation or basic fetching
async function cleanupExpiredDailyMenus(firestoreDb: any, messId: string, todayStr: string) {
  try {
    const { collection, getDocs, writeBatch, query, where } = await import("firebase/firestore");
    const dailyMenuRef = collection(firestoreDb, "daily_menus");
    
    // Fetch all documents for this mess to safely filter client-side without requiring composite indexes
    const q = query(dailyMenuRef, where("messId", "==", messId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(firestoreDb);
    let deletedCount = 0;

    snapshot.docs.forEach((docItem) => {
      const data = docItem.data();
      // Compare date strings directly (e.g. "2026-10-02" < "2026-11-13")
      if (data.date && data.date < todayStr) {
        batch.delete(docItem.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`🧹 Cleaned up ${deletedCount} expired past daily menus for ${messId}.`);
    }
  } catch (err) {
    console.error("[CleanupHelper] Failed to purge expired daily menus:", err);
  }
}

function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== "object") return data;
  
  if (Array.isArray(data)) {
    return data.map(cleanFirestoreData);
  }
  
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined) {
      cleaned[key] = cleanFirestoreData(val);
    }
  }
  return cleaned;
}

function NutritionistPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [isMultiMessActive, setIsMultiMessActive] = useState(false);
  const [selectedMess, setSelectedMess] = useState<MessId>("jmb");
  const [selectedMessIds, setSelectedMessIds] = useState<string[]>(["jmb"]);
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"cards" | "matrix">("cards");

  const [menu, setMenu] = useState<StudioDayMenu>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });
  const [initialLoadedMenu, setInitialLoadedMenu] = useState<StudioDayMenu | null>(null);

  const { ready: authReady, claims } = useOperatorAuth();
  useEffect(() => {
    if (!authReady) return;
    const allowed = (role?: string) => role === "nutritionist" || role === "super-admin";
    const activeSession = getAdminSession();
    if (activeSession && allowed(activeSession.role) && allowed(claims?.role)) {
      setIsAuthenticated(true);
    } else {
      if (activeSession) clearAdminSession();
      setIsAuthenticated(false);
    }
  }, [authReady, claims]);

  const activePrimaryMess = isMultiMessActive ? (selectedMessIds[0] || "jmb") : selectedMess;

  // 🧹 Run automated background cleanup of expired daily menus on session load
  useEffect(() => {
    if (!isAuthenticated || !db || !activePrimaryMess) return;
    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    cleanupExpiredDailyMenus(db, activePrimaryMess, todayStr);
  }, [isAuthenticated, activePrimaryMess]);

  useEffect(() => {
    if (!isAuthenticated || !db || !selectedDate) return;
    const firestoreDb = db;
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const cacheKey = `nutri_menu_${activePrimaryMess}_${selectedDate}`;
      
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (isMounted) {
            setMenu(parsed);
            setInitialLoadedMenu(JSON.parse(JSON.stringify(parsed)));
            setIsLoading(false);
            return;
          }
        } catch (e) {
          // Fallback
        }
      }

      try {
        const dailyDocRef = doc(firestoreDb, "daily_menus", `${activePrimaryMess}_${selectedDate}`);
        const dailySnap = await getDoc(dailyDocRef);
        
        if (!isMounted) return;

        if (dailySnap.exists()) {
          const firestoreData = dailySnap.data();
          const sanitizedMenu: StudioDayMenu = {
            breakfast: (firestoreData.breakfast || []).map(sanitizeDishItem),
            lunch: (firestoreData.lunch || []).map(sanitizeDishItem),
            snacks: (firestoreData.snacks || []).map(sanitizeDishItem),
            dinner: (firestoreData.dinner || []).map(sanitizeDishItem),
          };
          setMenu(sanitizedMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(sanitizedMenu)));
          localStorage.setItem(cacheKey, JSON.stringify(sanitizedMenu));
        } else {
          const emptyMenu: StudioDayMenu = { breakfast: [], lunch: [], snacks: [], dinner: [] };
          setMenu(emptyMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(emptyMenu)));
        }
      } catch (err) {
        if (isMounted) console.error("Error loading menu:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [activePrimaryMess, selectedDate, isAuthenticated]);

  function sanitizeDishItem(item: any): StudioDishItem {
    if (typeof item === "string") {
      return {
        name: item,
        servingSize: "1 Portion",
        regionalTag: "",
        specialTag: "",
        description: "",
        originStory: "",
        funFact: "",
        recipe: { ingredients: "", method: "" },
        calories: 220,
        protein: 7,
        carbs: 30,
        fat: 6,
        saturatedFat: 1.5,
        fiber: 3,
        addedSugar: 0,
        micronutrients: {
          iron: 1.5, calcium: 40, magnesium: 25, potassium: 150, sodium: 180, zinc: 0.8,
          vitaminA: 25, vitaminC: 3, vitaminB12: 0, folate: 20, vitaminD: 0, vitaminB6: 0.2
        }
      };
    }
    return {
      name: item.name || "",
      servingSize: item.servingSize || "1 Portion",
      regionalTag: item.regionalTag || "",
      specialTag: item.specialTag || "",
      description: item.description || "",
      originStory: item.originStory || "",
      funFact: item.funFact || "",
      recipe: {
        ingredients: item.recipe?.ingredients || "",
        method: item.recipe?.method || "",
      },
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      saturatedFat: item.saturatedFat ?? 0,
      fiber: item.fiber ?? 0,
      addedSugar: item.addedSugar ?? 0,
      micronutrients: {
        iron: item.micronutrients?.iron ?? 0,
        calcium: item.micronutrients?.calcium ?? 0,
        magnesium: item.micronutrients?.magnesium ?? 0,
        potassium: item.micronutrients?.potassium ?? 0,
        sodium: item.micronutrients?.sodium ?? 0,
        zinc: item.micronutrients?.zinc ?? 0,
        vitaminA: item.micronutrients?.vitaminA ?? 0,
        vitaminC: item.micronutrients?.vitaminC ?? 0,
        vitaminB12: item.micronutrients?.vitaminB12 ?? 0,
        folate: item.micronutrients?.folate ?? 0,
        vitaminD: item.micronutrients?.vitaminD ?? 0,
        vitaminB6: item.micronutrients?.vitaminB6 ?? 0,
      }
    };
  }

  const hasUnsavedChanges = useMemo(() => {
    if (!initialLoadedMenu) return false;
    return JSON.stringify(menu) !== JSON.stringify(initialLoadedMenu);
  }, [menu, initialLoadedMenu]);

  const detailedChangesSummary = useMemo(() => {
    if (!initialLoadedMenu) return [];
    const diffs: string[] = [];

    MEAL_TYPES.forEach((meal) => {
      const oldList = initialLoadedMenu[meal] || [];
      const newList = menu[meal] || [];

      if (oldList.length !== newList.length) {
        diffs.push(`• [${meal.toUpperCase()}] Item count changed from ${oldList.length} to ${newList.length}.`);
      }
    });

    return diffs;
  }, [menu, initialLoadedMenu]);

  const totalDishesCount = useMemo(() => {
    return menu.breakfast.length + menu.lunch.length + menu.snacks.length + menu.dinner.length;
  }, [menu]);

  const upcomingDateOptions = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let offset = 0; offset < 10; offset++) {
      const target = new Date(base);
      target.setDate(base.getDate() + offset);
      const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
      const dayName = target.toLocaleDateString("en-IN", { weekday: "short" });
      const monthDay = target.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      list.push({ key, label: `${dayName}, ${monthDay}`, isToday: offset === 0 });
    }
    return list;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const match = await loginOperator({ data: { password: passwordInput, area: "nutritionist" } });
      if (!auth) throw new Error("Firebase auth unavailable");
      await signInWithCustomToken(auth, match.token);
      saveAdminSession({ role: match.role, messId: match.messId });
      setIsAuthenticated(true);
      setAuthError("");
    } catch (error) {
      console.error("[nutritionist-login]", error);
      const message = error instanceof Error ? error.message : "";
      setAuthError(message && message !== "Invalid password." ? message : "Invalid Nutritionist Authorization Key");
      if ("vibrate" in navigator) navigator.vibrate(200);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
  };

  const toggleDetails = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddItem = (meal: keyof StudioDayMenu) => {
    const newDish: StudioDishItem = {
      name: "",
      servingSize: "1 Portion",
      regionalTag: "",
      specialTag: "",
      description: "",
      originStory: "",
      funFact: "",
      recipe: { ingredients: "", method: "" },
      calories: 200,
      protein: 6,
      carbs: 25,
      fat: 5,
      saturatedFat: 1,
      fiber: 2,
      addedSugar: 0,
      micronutrients: {
        iron: 0, calcium: 0, magnesium: 0, potassium: 0, sodium: 0, zinc: 0,
        vitaminA: 0, vitaminC: 0, vitaminB12: 0, folate: 0, vitaminD: 0, vitaminB6: 0
      }
    };

    setMenu((prev) => ({
      ...prev,
      [meal]: [...prev[meal], newDish],
    }));
  };

  const handleRemoveItem = (meal: keyof StudioDayMenu, index: number) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== index),
    }));
  };

  const handleItemFieldChange = (
    meal: keyof StudioDayMenu,
    index: number,
    field: keyof StudioDishItem,
    value: any
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      updatedMeal[index] = { ...updatedMeal[index], [field]: value };
      return { ...prev, [meal]: updatedMeal };
    });
  };

 const handleSave = async () => {
    if (!hasUnsavedChanges) {
      alert("ℹ️ No changes detected!");
      return;
    }

    if (!db || !selectedDate) return;

    const targetMessList = isMultiMessActive ? selectedMessIds : [selectedMess];
    if (targetMessList.length === 0) {
      alert("⚠️ Please select at least one mess facility to publish.");
      return;
    }

    if (!confirm(`🚀 Publish nutritional changes for ${targetMessList.length} mess(es) on ${selectedDate}?`)) {
      return;
    }

    const firestoreDb = db;
    setIsSaving(true);

    try {
      const batch = writeBatch(firestoreDb);

      targetMessList.forEach((messId) => {
        // 1. Save the daily menu document
        const docRef = doc(firestoreDb, "daily_menus", `${messId}_${selectedDate}`);
        const payload = cleanFirestoreData({
          ...menu,
          messId,
          date: selectedDate,
          updatedAt: serverTimestamp(),
          updatedByRole: "nutritionist",
        });
        batch.set(docRef, payload, { merge: true });

        // 2. 🌟 CRITICAL FIX: Automatically bump the version counter in mess_meta!
        const metaRef = doc(firestoreDb, "mess_meta", messId);
        batch.set(metaRef, {
          version: Date.now(), // Unique timestamp version forces student cache invalidation
          lastPublishedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();

      targetMessList.forEach((messId) => {
        localStorage.setItem(`nutri_menu_${messId}_${selectedDate}`, JSON.stringify(menu));
      });

      setInitialLoadedMenu(JSON.parse(JSON.stringify(menu)));
      alert(`✅ Published successfully for ${selectedDate} across ${targetMessList.length} mess(es).`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!authReady) {
    return <div className="min-h-screen bg-[#E9F7F4]" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#E9F7F4] flex items-center justify-center px-4 font-sans select-none text-[#193A40]">
        <div className="w-full max-w-sm bg-white border-2 border-[#B5DED4] rounded-3xl p-6 shadow-xl text-center">
          <div className="w-14 h-14 bg-[#007F86] rounded-2xl flex items-center justify-center mx-auto text-white shadow-md mb-4">
            <HeartPulse className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-[#193A40]">Nutritionist Studio</h1>
          <p className="text-xs text-[#193A40]/70 mt-1 font-medium">Campus Food Profile &amp; Macro Console</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-3.5">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Passkey"
                className="w-full bg-[#E9F7F4]/40 border-2 border-[#B5DED4] rounded-xl px-4 py-3 text-xs font-bold text-[#193A40] focus:outline-none focus:border-[#007F86] focus:bg-white transition"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-[#007F86] text-white font-bold py-3.5 rounded-xl shadow-md hover:opacity-90 active:scale-[0.99] transition text-xs cursor-pointer"
            >
              Authenticate Studio Session
            </button>
          </form>

          <p className="mt-6 text-[10px] text-[#193A40]/70 font-semibold">
            <Link to="/" className="underline hover:text-[#193A40]">
              &larr; Exit to Student Portal
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E9F7F4] text-[#193A40] font-sans flex flex-col md:flex-row select-none">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-[#B5DED4] sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 rounded-xl border border-[#B5DED4] bg-[#E9F7F4] text-[#007F86]"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="font-bold text-sm leading-none flex items-center gap-1.5 text-[#193A40]">
              <HeartPulse className="w-4 h-4 text-[#007F86]" /> Nutrition Studio
              
            </h1>
            <span className="text-[10px] text-[#193A40]/70">VIT Bhopal Campus</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChangeOperatorPassword />
          <button
            onClick={handleLogout}
            className="text-xs font-bold text-red-600 flex items-center gap-1 border border-red-200 px-2.5 py-1 rounded-xl bg-red-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#B5DED4] p-5 flex flex-col justify-between transition-transform duration-200 ease-in-out
        md:translate-x-0 md:static md:w-72 shrink-0
        ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}>
        <div className="space-y-6 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#007F86] flex items-center justify-center text-white shadow-sm">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#193A40]">NutriStudio</h2>
                <p className="text-[10px] font-bold text-[#193A40]/70 uppercase tracking-wider">Campus Nutrition</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg border border-[#B5DED4] text-[#193A40]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#B5DED4]">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#193A40]/70">
              Editing View Layout
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#E9F7F4] p-1 rounded-xl border border-[#B5DED4]">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition ${
                  viewMode === "cards" ? "bg-[#007F86] text-white shadow-xs" : "text-[#193A40]/70"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition ${
                  viewMode === "matrix" ? "bg-[#007F86] text-white shadow-xs" : "text-[#193A40]/70"
                }`}
              >
                <Table className="w-3.5 h-3.5" /> Matrix
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#B5DED4]">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#193A40]/70">
                Multi-Mess Selection
              </label>
              <button
                type="button"
                onClick={() => setIsMultiMessActive(!isMultiMessActive)}
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition cursor-pointer border ${
                  isMultiMessActive ? "bg-[#007F86] text-white border-[#007F86]" : "bg-[#E9F7F4] text-[#193A40]/70 border-[#B5DED4]"
                }`}
              >
                {isMultiMessActive ? "Enabled" : "Disabled"}
              </button>
            </div>

            {isMultiMessActive ? (
              <div className="space-y-1.5 bg-[#E9F7F4]/40 p-2.5 rounded-2xl border border-[#B5DED4]">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#B5DED4]">
                  <span className="text-[10px] font-bold text-[#193A40]">Select Target Messes</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nonJmbIds = MESSES.filter(m => m.id !== "jmb").map(m => m.id);
                      setSelectedMessIds(selectedMessIds.length === nonJmbIds.length ? [] : nonJmbIds);
                    }}
                    className="text-[10px] font-bold text-[#007F86] hover:underline cursor-pointer"
                  >
                    {selectedMessIds.length === MESSES.filter(m => m.id !== "jmb").length ? "Clear" : "Select All (Excl. JMB)"}
                  </button>
                </div>

                {MESSES.map((m) => {
                  const isChecked = selectedMessIds.includes(m.id);
                  const isJmb = m.id === "jmb";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessIds(prev => 
                          prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                        );
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isChecked ? "bg-[#007F86] text-white" : "bg-white text-[#193A40] border border-[#B5DED4]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-[#193A40]/40" />}
                        {m.name}
                      </span>
                      {isJmb && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">Diff Menu</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <label className="block text-[9px] font-bold text-[#193A40]/60 uppercase mb-1">Active Facility</label>
                <select
                  value={selectedMess}
                  onChange={(e) => setSelectedMess(e.target.value as MessId)}
                  className="w-full bg-[#E9F7F4]/40 border-2 border-[#B5DED4] rounded-xl px-3 py-2 text-xs font-bold text-[#193A40] focus:outline-none focus:border-[#007F86]"
                >
                  {MESSES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.subtitle ? `(${m.subtitle})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#B5DED4] space-y-2">
          <Link
            to="/admin"
            className="w-full flex items-center justify-between text-xs font-bold text-[#193A40]/70 hover:text-[#193A40] px-3 py-2 rounded-xl hover:bg-[#E9F7F4] transition"
          >
            <span>Operator Console</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>End Studio Session</span>
          </button>
        </div>
      </aside>

      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 md:hidden"
        />
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 p-4 md:p-8 max-w-[1600px] overflow-y-auto">
        <div className="bg-white rounded-3xl p-5 border-2 border-[#B5DED4] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#007F86]/10 text-[#007F86] border border-[#007F86]/20">
                📅 Daily Studio Workspace
              </span>
              
              <div className="flex items-center gap-1.5 ml-1 bg-[#E9F7F4] border border-[#B5DED4] px-2.5 py-1 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-[#007F86]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                    const val = e.target.value;
                    if (val) setSelectedDate(val);
                  }}
                  className="bg-transparent text-[11px] font-bold text-[#193A40] outline-none cursor-pointer"
                />
              </div>
            </div>
            <h2 className="text-xl font-black text-[#193A40] mt-1.5">Nutritional Menu Studio</h2>
            <p className="text-xs text-[#193A40]/70 mt-0.5 font-medium">
              {isMultiMessActive 
                ? `Publishing across ${selectedMessIds.length} selected mess(es)` 
                : `Editing single facility: ${MESSES.find(m => m.id === selectedMess)?.name}`} 
              {" "}for date <span className="font-bold underline">{selectedDate}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold shadow-sm active:scale-95 transition flex items-center gap-2 cursor-pointer ${
                hasUnsavedChanges ? "bg-[#007F86] text-white hover:opacity-90" : "bg-white text-[#193A40]/40 border-2 border-[#B5DED4]"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Publishing Data..." : "Publish Menu"}
            </button>
          </div>
        </div>

        {/* Date Switcher */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {upcomingDateOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                if (hasUnsavedChanges && !confirm("Switching dates will discard unsaved modifications. Continue?")) return;
                setSelectedDate(opt.key);
              }}
              className={`shrink-0 rounded-2xl border-2 px-4 py-2.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedDate === opt.key
                  ? "border-[#007F86] bg-[#007F86] text-white shadow-sm"
                  : "border-[#B5DED4] bg-white text-[#193A40]/70 hover:text-[#193A40]"
              }`}
            >
              <span>{opt.label}</span>
              {opt.isToday && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase ${
                  selectedDate === opt.key ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  Today
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Change Indicator Banner */}
        <div className="bg-white border-2 border-[#B5DED4] rounded-2xl p-4 mb-6 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#193A40]/70">
              Configuring Date: <span className="text-[#193A40] underline font-black">{selectedDate}</span> ({totalDishesCount} Registered Dishes)
            </span>

            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> {detailedChangesSummary.length} Unsaved Adjustment(s) Pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Synced with Live Platform
              </span>
            )}
          </div>
        </div>

        {/* Cards View Mode */}
        {viewMode === "cards" && (
          isLoading ? (
            <div className="py-20 text-center text-xs font-bold text-[#193A40]/70 bg-white rounded-3xl border-2 border-[#B5DED4]">
              Loading nutritional models from database...
            </div>
          ) : (
            <div className="space-y-6">
              {MEAL_TYPES.map((mealType) => (
                <div key={mealType} className="bg-white rounded-3xl border-2 border-[#B5DED4] p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#B5DED4]/70">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black uppercase tracking-wider text-[#193A40] flex items-center gap-1.5">
                        <span>🍽️</span> {mealType}
                      </span>
                      <span className="text-[10px] font-bold bg-[#E9F7F4] text-[#007F86] px-2 py-0.5 rounded-full border border-[#B5DED4]">
                        {menu[mealType].length} Items
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddItem(mealType)}
                      className="text-[11px] font-bold text-[#007F86] bg-[#E9F7F4] border border-[#B5DED4] px-3.5 py-1.5 rounded-xl flex items-center gap-1 hover:bg-[#B5DED4]/30 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Dish Profile
                    </button>
                  </div>

                  {menu[mealType].length === 0 ? (
                    <p className="text-xs italic text-[#193A40]/60 py-6 text-center font-medium">
                      No dish entries configured for {mealType} on {selectedDate}. Click "+ Add Dish Profile" to begin.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {menu[mealType].map((dish, idx) => {
                        const itemKey = `${mealType}_${idx}`;
                        const isExpanded = !!expandedCards[itemKey];

                        return (
                          <div key={idx} className="bg-[#E9F7F4]/40 border-2 border-[#B5DED4] rounded-2xl p-4 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                              <div className="sm:col-span-5">
                                <label className="block text-[9px] uppercase font-black text-[#193A40]/70 mb-1">Dish Title</label>
                                <input
                                  type="text"
                                  value={dish.name}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "name", e.target.value)}
                                  placeholder="Dish name"
                                  className="w-full bg-white border border-[#B5DED4] rounded-xl px-3 py-2 text-xs font-bold text-[#193A40]"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[9px] uppercase font-black text-[#193A40]/70 mb-1">Serving Qty</label>
                                <input
                                  type="text"
                                  value={dish.servingSize || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "servingSize", e.target.value)}
                                  placeholder="1 Portion"
                                  className="w-full bg-white border border-[#B5DED4] rounded-xl px-3 py-2 text-xs font-bold text-[#193A40]"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[9px] uppercase font-black text-[#193A40]/70 mb-1">Regional Tag</label>
                                <input
                                  type="text"
                                  value={dish.regionalTag || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "regionalTag", e.target.value)}
                                  placeholder="Optional"
                                  className="w-full bg-white border border-[#B5DED4] rounded-xl px-3 py-2 text-xs font-bold text-[#007F86]"
                                />
                              </div>
                              <div className="sm:col-span-2 flex items-center justify-end gap-1.5 pt-4">
                                <button
                                  type="button"
                                  onClick={() => toggleDetails(itemKey)}
                                  className="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 bg-white text-[#193A40] border-[#B5DED4] cursor-pointer"
                                >
                                  <BookOpen className="w-3.5 h-3.5" /> <span>{isExpanded ? "Hide" : "Details"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(mealType, idx)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Matrix View Mode */}
        {viewMode === "matrix" && (
          <div className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm text-center">
            <p className="text-xs font-bold text-[#193A40]/70">Spreadsheet Matrix mode is optimized. Use Cards view above for quick single-day edits.</p>
          </div>
        )}
      </main>
    </div>
  );
}