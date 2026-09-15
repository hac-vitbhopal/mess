import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { 
  MESSES, 
  saveDynamicMessMenu, 
  getDynamicMessMenu, 
  ADMIN_AUTH_KEYS,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  type MessId, 
  type DayMenuWithNutrition, 
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
  ChefHat
} from "lucide-react";

export const Route = createFileRoute("/nutritionist")({
  head: () => ({
    meta: [
      { title: "Nutritionist Studio — MessHub VIT Bhopal" },
      { name: "description", content: "Master nutritional studio for macros, micronutrients, and regional food profiles." }
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

// Helper to recursively remove undefined values so Firestore never throws unsupported field errors
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

  const [selectedMess, setSelectedMess] = useState<MessId>("jmb");
  
  // Specific Calendar Date (Matches Excel / Google Sheets push date YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Menu States
  const [menu, setMenu] = useState<StudioDayMenu>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });
  const [initialLoadedMenu, setInitialLoadedMenu] = useState<StudioDayMenu | null>(null);

  // 🔒 Secure Session Initialization on Mount (Browser-close safe via sessionStorage)
  useEffect(() => {
    const activeSession = getAdminSession();
    if (activeSession && (activeSession.role === "nutritionist" || activeSession.role === "super-admin")) {
      setIsAuthenticated(true);
    } else {
      clearAdminSession();
      setIsAuthenticated(false);
    }
  }, []);

  // Fetch dynamic menu directly from Firestore daily_menus/{messId}_{YYYY-MM-DD}
  useEffect(() => {
    if (!isAuthenticated || !db || !selectedDate) return;
    const firestoreDb = db;

    async function load() {
      setIsLoading(true);
      let firestoreData: any = null;

      try {
        const dailyDocRef = doc(firestoreDb, "daily_menus", `${selectedMess}_${selectedDate}`);
        const dailySnap = await getDoc(dailyDocRef);
        if (dailySnap.exists()) {
          firestoreData = dailySnap.data();
        }

        if (firestoreData) {
          const sanitizedMenu: StudioDayMenu = {
            breakfast: (firestoreData.breakfast || []).map(sanitizeDishItem),
            lunch: (firestoreData.lunch || []).map(sanitizeDishItem),
            snacks: (firestoreData.snacks || []).map(sanitizeDishItem),
            dinner: (firestoreData.dinner || []).map(sanitizeDishItem),
          };
          setMenu(sanitizedMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(sanitizedMenu)));
        } else {
          const emptyMenu: StudioDayMenu = { breakfast: [], lunch: [], snacks: [], dinner: [] };
          setMenu(emptyMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(emptyMenu)));
        }
      } catch (err) {
        console.error("Error loading menu:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [selectedMess, selectedDate, isAuthenticated]);

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

  // Determine Unsaved Changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialLoadedMenu) return false;
    return JSON.stringify(menu) !== JSON.stringify(initialLoadedMenu);
  }, [menu, initialLoadedMenu]);

  // Compute exact human-readable diff changes between initial loaded state and current draft state
  const detailedChangesSummary = useMemo(() => {
    if (!initialLoadedMenu) return [];
    const diffs: string[] = [];

    MEAL_TYPES.forEach((meal) => {
      const oldList = initialLoadedMenu[meal] || [];
      const newList = menu[meal] || [];

      if (oldList.length !== newList.length) {
        diffs.push(`• [${meal.toUpperCase()}] Item count changed from ${oldList.length} to ${newList.length}.`);
      }

      newList.forEach((item, idx) => {
        const prevItem = oldList[idx];
        if (!prevItem) {
          diffs.push(`  + Added new dish: "${item.name || 'Untitled'}"`);
        } else {
          if (prevItem.name !== item.name) {
            diffs.push(`  ~ Renamed dish "${prevItem.name}" to "${item.name}"`);
          }
          if (prevItem.calories !== item.calories || prevItem.protein !== item.protein || prevItem.carbs !== item.carbs) {
            diffs.push(`  ~ Calibrated macros for "${item.name || 'Dish'}": Energy ${prevItem.calories}→${item.calories} kcal, Protein ${prevItem.protein}→${item.protein}g`);
          }
          if (prevItem.regionalTag !== item.regionalTag && item.regionalTag) {
            diffs.push(`  ~ Updated regional tag for "${item.name}": ${item.regionalTag}`);
          }
        }
      });
    });

    return diffs;
  }, [menu, initialLoadedMenu]);

  const totalDishesCount = useMemo(() => {
    return menu.breakfast.length + menu.lunch.length + menu.snacks.length + menu.dinner.length;
  }, [menu]);

  // Compute upcoming date options for horizontal switcher
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = passwordInput.trim();
    const match = ADMIN_AUTH_KEYS[cleanKey];

    if (match && (match.role === "nutritionist" || match.role === "super-admin")) {
      saveAdminSession({ role: match.role });
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Invalid Nutritionist Authorization Key");
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

  const handleRecipeChange = (
    meal: keyof StudioDayMenu,
    index: number,
    subfield: "ingredients" | "method",
    value: string
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      const current = updatedMeal[index].recipe || {};
      updatedMeal[index] = {
        ...updatedMeal[index],
        recipe: { ...current, [subfield]: value }
      };
      return { ...prev, [meal]: updatedMeal };
    });
  };

  const handleMicroNutrientChange = (
    meal: keyof StudioDayMenu,
    dishIndex: number,
    microKey: keyof MicronutrientProfile,
    value: number
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      const targetDish = { ...updatedMeal[dishIndex] };
      targetDish.micronutrients = {
        ...(targetDish.micronutrients || {}),
        [microKey]: value,
      };
      updatedMeal[dishIndex] = targetDish;
      return { ...prev, [meal]: updatedMeal };
    });
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      alert("ℹ️ No changes detected!\n\nYou haven't modified any dish profiles or nutritional numbers.");
      return;
    }

    if (!db || !selectedDate) return;

    // Build clear confirmation prompt detailing detected changes
    const diffMessage = detailedChangesSummary.length > 0 
      ? `\n\nDetected Modifications:\n` + detailedChangesSummary.slice(0, 8).join("\n") + (detailedChangesSummary.length > 8 ? "\n  ...and more updates" : "")
      : "";

    if (!confirm(`🚀 Publish changes for ${selectedMess.toUpperCase()} on ${selectedDate}?${diffMessage}`)) {
      return;
    }

    const firestoreDb = db;
    setIsSaving(true);

    try {
      const docRef = doc(firestoreDb, "daily_menus", `${selectedMess}_${selectedDate}`);
      const payload = cleanFirestoreData({
        ...menu,
        messId: selectedMess,
        date: selectedDate,
        updatedAt: serverTimestamp(),
        updatedByRole: "nutritionist",
      });

      await setDoc(docRef, payload, { merge: true });

      // Also persist to recurring weekday template for backward compatibility
      const dayIndex = new Date(selectedDate + "T00:00:00").getDay();
      await saveDynamicMessMenu(selectedMess, dayIndex, menu as DayMenuWithNutrition);

      // Create an audit log record for tracking what was changed
      await addDoc(collection(firestoreDb, "admin_audit_logs"), {
        messId: selectedMess,
        action: "Nutrition Studio Menu Updated",
        details: `Updated nutrition profile for date ${selectedDate}. Changes: ${detailedChangesSummary.length} adjustments made.`,
        operatorRole: "nutritionist",
        timestamp: serverTimestamp(),
      });

      setInitialLoadedMenu(JSON.parse(JSON.stringify(menu)));
      alert(`✅ Nutrition Studio Published!\n\nAll primary macros, recipes, and nutritional profiles for date ${selectedDate} are live in Firebase.`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update Firestore. Please check your network connection.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------------- 🔒 LOGIN SCREEN ---------------- */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fbf7f2] flex items-center justify-center px-4 font-sans select-none">
        <div className="w-full max-w-sm bg-white border border-border rounded-3xl p-6 shadow-xl text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center mx-auto text-white shadow-md shadow-emerald-500/20 mb-4">
            <HeartPulse className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-foreground">Nutritionist Studio</h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Campus Food Profile &amp; Macro Console</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-3.5">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Authorization Passkey"
                className="w-full bg-[#fbf7f2] border border-border rounded-xl px-4 py-3 text-xs font-bold text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-black active:scale-[0.99] transition text-xs cursor-pointer"
            >
              Authenticate Studio Session
            </button>
          </form>

          <p className="mt-6 text-[10px] text-muted-foreground font-semibold">
            <Link to="/" className="underline hover:text-foreground">
              &larr; Exit to Student Portal
            </Link>
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- 🥗 SAAS DASHBOARD INTERFACE ---------------- */
  return (
    <div className="min-h-screen bg-[#fbf7f2] text-foreground font-sans flex flex-col md:flex-row select-none">
      
      {/* 📱 Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 rounded-xl border border-border bg-slate-50 text-slate-700"
            aria-label="Toggle Menu"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="font-bold text-sm leading-none flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-emerald-600" /> Nutrition Studio
            </h1>
            <span className="text-[10px] text-muted-foreground">VIT Bhopal Campus</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs font-bold text-red-600 flex items-center gap-1 border border-border px-2.5 py-1 rounded-xl bg-red-50/50"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </div>

      {/* 🧭 SaaS Left Navigation Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border p-5 flex flex-col justify-between transition-transform duration-200 ease-in-out
        md:translate-x-0 md:static md:w-72 shrink-0
        ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}>
        <div className="space-y-6 overflow-y-auto pr-1">
          
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-foreground">NutriStudio</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campus Nutrition</p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg border border-border text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Facility Picker */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Select Mess Facility
            </label>
            <div className="space-y-1">
              {MESSES.map((m) => {
                const isSelected = selectedMess === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (hasUnsavedChanges && !confirm("Discard unsaved draft changes and switch mess facility?")) return;
                      setSelectedMess(m.id as MessId);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                    }`}
                  >
                    <span>{m.name} {m.subtitle ? `(${m.subtitle})` : ""}</span>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-border space-y-2">
          <Link
            to="/admin"
            className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-slate-50 transition"
          >
            <span>Mess Operator Console</span>
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

      {/* Backdrop for Mobile Sidebar */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 md:hidden"
        />
      )}

      {/* 💻 Main Workspace Central Studio */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl overflow-y-auto">
        
        {/* Workspace Top Header Card */}
        <div className="bg-white rounded-3xl p-5 border border-border shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {MESSES.find(m => m.id === selectedMess)?.name}
              </span>
              
              {/* Date Picker directly tied to daily_menus */}
              <div className="flex items-center gap-1.5 ml-1 bg-[#fbf7f2] border border-border/80 px-2.5 py-1 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                    const val = e.target.value;
                    if (val) setSelectedDate(val);
                  }}
                  className="bg-transparent text-[11px] font-bold text-foreground outline-none cursor-pointer"
                />
              </div>
            </div>
            <h2 className="text-xl font-black text-foreground mt-1.5">Nutritional Menu Studio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live-edit daily menus pushed from Google Sheets or manage master nutrition breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold shadow-card active:scale-95 transition flex items-center gap-2 cursor-pointer ${
                hasUnsavedChanges
                  ? "gradient-warm text-white"
                  : "bg-slate-100 text-slate-400 border border-border"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Publishing Data..." : "Publish Nutritional Profiles"}
            </button>
          </div>
        </div>

        {/* 📅 Date-by-Date Horizontal Switcher */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {upcomingDateOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                if (hasUnsavedChanges && !confirm("Switching dates will discard unsaved modifications. Continue?")) return;
                setSelectedDate(opt.key);
              }}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedDate === opt.key
                  ? "border-transparent bg-slate-900 text-white shadow-card"
                  : "border-border bg-white text-muted-foreground hover:text-foreground"
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

        {/* Change Indicator Status Banner & Diff Inspector */}
        <div className="bg-white border border-border rounded-2xl p-4 mb-6 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">
              Configuring Date: <span className="text-foreground underline">{selectedDate}</span> ({totalDishesCount} Registered Dishes)
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

          {/* Detailed Changes Inspector Box */}
          {hasUnsavedChanges && detailedChangesSummary.length > 0 && (
            <div className="mt-2 bg-[#fbf7f2] border border-amber-200/80 p-3 rounded-xl space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider block mb-1">
                🔍 Live Diff Inspector (Pending Changes):
              </span>
              <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                {detailedChangesSummary.map((diffLine, i) => (
                  <li key={i} className="text-[11px] font-medium text-slate-700 font-mono">
                    {diffLine}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Meals Cards Container */}
        {isLoading ? (
          <div className="py-20 text-center text-xs font-bold text-muted-foreground bg-white rounded-3xl border border-border">
            Loading nutritional models from database...
          </div>
        ) : (
          <div className="space-y-6">
            {MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="bg-white rounded-3xl border border-border p-5 shadow-card space-y-4">
                
                {/* Meal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/70">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <span>🍽️</span> {mealType}
                    </span>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {menu[mealType].length} Items
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddItem(mealType)}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Dish Profile
                  </button>
                </div>

                {menu[mealType].length === 0 ? (
                  <p className="text-xs italic text-muted-foreground/60 py-6 text-center">
                    No dish entries configured for {mealType} on {selectedDate}. Click "+ Add Dish Profile" to build this meal's breakdown.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {menu[mealType].map((dish, idx) => {
                      const itemKey = `${mealType}_${idx}`;
                      const isExpanded = !!expandedCards[itemKey];

                      return (
                        <div key={idx} className="bg-[#fbf7f2] border border-border/80 rounded-2xl p-4 space-y-3.5">
                          
                          {/* Row 1: Dish Identity, Regional Tag, Serving Size & Expand Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            
                            {/* Dish Name */}
                            <div className="sm:col-span-5">
                              <label className="block text-[9px] uppercase font-black text-muted-foreground mb-1">
                                Dish Title
                              </label>
                              <input
                                type="text"
                                value={dish.name}
                                onChange={(e) => handleItemFieldChange(mealType, idx, "name", e.target.value)}
                                placeholder="e.g. Sambar, Rajma Masala, Aloo Posto"
                                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-emerald-600"
                              />
                            </div>

                            {/* Serving Size */}
                            <div className="sm:col-span-2">
                              <label className="block text-[9px] uppercase font-black text-muted-foreground mb-1">
                                Serving Qty
                              </label>
                              <input
                                type="text"
                                value={dish.servingSize || ""}
                                onChange={(e) => handleItemFieldChange(mealType, idx, "servingSize", e.target.value)}
                                placeholder="1 Bowl (150g)"
                                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-emerald-600"
                              />
                            </div>

                            {/* Regional / State Tag */}
                            <div className="sm:col-span-3">
                              <label className="block text-[9px] uppercase font-black text-muted-foreground mb-1 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-emerald-600" /> Regional Tag
                              </label>
                              <input
                                type="text"
                                list={`regional_tags_${itemKey}`}
                                value={dish.regionalTag || ""}
                                onChange={(e) => handleItemFieldChange(mealType, idx, "regionalTag", e.target.value)}
                                placeholder="Optional (e.g. Tamil Nadu Style)"
                                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                              />
                              <datalist id={`regional_tags_${itemKey}`}>
                                {POPULAR_REGIONS.map((r) => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </div>

                            {/* Controls */}
                            <div className="sm:col-span-2 flex items-center justify-end gap-1.5 pt-2 sm:pt-4">
                              <button
                                type="button"
                                onClick={() => toggleDetails(itemKey)}
                                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                                  isExpanded ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-border hover:bg-slate-50"
                                }`}
                                title="Expand Food Profile & Micronutrients"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>{isExpanded ? "Hide" : "Details"}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(mealType, idx)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                title="Remove Dish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: 7 Primary Macro Values */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500" /> Primary Nutritional Values (Main Menu Display)
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                              {/* Energy */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-orange-700 block">Energy (kcal)</span>
                                <input
                                  type="number"
                                  value={dish.calories || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "calories", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Protein */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-emerald-700 block">Protein (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.protein || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "protein", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Carbohydrate */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-amber-700 block">Carbs (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.carbs || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "carbs", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Total Fat */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-blue-700 block">Total Fat (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.fat || ""}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "fat", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Saturated Fat */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-indigo-700 block">Sat. Fat (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.saturatedFat ?? 0}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "saturatedFat", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Fibre */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-teal-700 block">Fibre (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.fiber ?? 0}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "fiber", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>

                              {/* Added Sugar */}
                              <div className="bg-white p-2 rounded-xl border border-border/80">
                                <span className="text-[9px] font-bold text-pink-700 block">Sugar (g)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={dish.addedSugar ?? 0}
                                  onChange={(e) => handleItemFieldChange(mealType, idx, "addedSugar", Number(e.target.value))}
                                  className="w-full font-black text-xs text-foreground bg-transparent outline-none mt-0.5"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Row 3: Expandable Cultural Profile, Chef Recipe & Micronutrients */}
                          {isExpanded && (
                            <div className="pt-4 border-t border-border/80 space-y-4 animate-fade-in bg-white p-4 rounded-2xl border border-border/80 shadow-xs">
                              
                              {/* Cultural Profile: Description, Origin, Trivia & Special Tag */}
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <h4 className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-emerald-600" /> Cultural Food Profile &amp; Knowledge Card
                                  </h4>

                                  <div className="w-48">
                                    <input
                                      type="text"
                                      value={dish.specialTag || ""}
                                      onChange={(e) => handleItemFieldChange(mealType, idx, "specialTag", e.target.value)}
                                      placeholder="Special Tag (e.g. State Special)"
                                      className="w-full bg-[#fbf7f2] border border-border rounded-lg px-2.5 py-1 text-[10px] font-bold text-purple-700 focus:outline-none focus:border-purple-500"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">
                                      Description &amp; Key Nutritional Perk
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={dish.description || ""}
                                      onChange={(e) => handleItemFieldChange(mealType, idx, "description", e.target.value)}
                                      placeholder="Brief overview of preparation, flavor profile, and health perks..."
                                      className="w-full bg-[#fbf7f2] border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">
                                      Origin &amp; Cultural Roots
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={dish.originStory || ""}
                                      onChange={(e) => handleItemFieldChange(mealType, idx, "originStory", e.target.value)}
                                      placeholder="Geographic roots, community history, or traditional culinary folklore..."
                                      className="w-full bg-[#fbf7f2] border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">
                                      Popular or Fun Trivia Fact
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={dish.funFact || ""}
                                      onChange={(e) => handleItemFieldChange(mealType, idx, "funFact", e.target.value)}
                                      placeholder="Fun facts, historical anecdotes, or traditional serving customs..."
                                      className="w-full bg-[#fbf7f2] border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Kitchen Team Standard Recipe (Chef View) */}
                              <div className="pt-2 border-t border-border/80">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2.5">
                                  <ChefHat className="w-3.5 h-3.5 text-amber-600" /> Kitchen Team Standard Recipe (Kitchen View)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">
                                      Standard Ingredients &amp; Quantities
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={dish.recipe?.ingredients || ""}
                                      onChange={(e) => handleRecipeChange(mealType, idx, "ingredients", e.target.value)}
                                      placeholder="Ingredients ratio per 100 students (e.g. 10kg Basmati Rice, 2kg Paneer)..."
                                      className="w-full bg-[#fbf7f2] border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-amber-600 focus:bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">
                                      Preparation Guidelines &amp; Method
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={dish.recipe?.method || ""}
                                      onChange={(e) => handleRecipeChange(mealType, idx, "method", e.target.value)}
                                      placeholder="Step-by-step cooking method to maintain consistency across shifts..."
                                      className="w-full bg-[#fbf7f2] border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-amber-600 focus:bg-white"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* 12 Essential Micronutrients Breakdown */}
                              <div className="pt-2 border-t border-border/80">
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 mb-2.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Micronutrients Breakdown ("Know More" Window)
                                </h4>

                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                  {[
                                    { key: "iron", label: "Iron", unit: "mg" },
                                    { key: "calcium", label: "Calcium", unit: "mg" },
                                    { key: "magnesium", label: "Magnesium", unit: "mg" },
                                    { key: "potassium", label: "Potassium", unit: "mg" },
                                    { key: "sodium", label: "Sodium", unit: "mg" },
                                    { key: "zinc", label: "Zinc", unit: "mg" },
                                    { key: "vitaminA", label: "Vitamin A", unit: "mcg" },
                                    { key: "vitaminC", label: "Vitamin C", unit: "mg" },
                                    { key: "vitaminB12", label: "Vitamin B12", unit: "mcg" },
                                    { key: "folate", label: "Folate", unit: "mcg" },
                                    { key: "vitaminD", label: "Vitamin D", unit: "mcg" },
                                    { key: "vitaminB6", label: "Vitamin B6", unit: "mg" },
                                  ].map((micro) => {
                                    const val = dish.micronutrients?.[micro.key as keyof MicronutrientProfile] ?? 0;
                                    return (
                                      <div key={micro.key} className="bg-[#fbf7f2] p-2 rounded-xl border border-border/80">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">
                                          {micro.label} ({micro.unit})
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={val || ""}
                                          onChange={(e) =>
                                            handleMicroNutrientChange(
                                              mealType,
                                              idx,
                                              micro.key as keyof MicronutrientProfile,
                                              Number(e.target.value)
                                            )
                                          }
                                          className="w-full font-bold text-xs text-foreground bg-transparent outline-none mt-0.5"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}