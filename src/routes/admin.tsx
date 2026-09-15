import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  // DEFAULT_WEEKLY,
  MEAL_DEFS,
  MESSES,
  dateKey,
  getOverrides,
  saveOverrides,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  verifyAdminPasscode,
  sendBroadcast,
  // HARDCODED_WEEKLY_MENUS,
  toggleFeedbackStatus,
  saveFirestoreOverride,
  deleteFirestoreOverride,
  type DayMenu,
  type MealKey,
  type MessId,
  type DayMenuWithNutrition,
  type ItemFeedback,
  type SpecialOverride,
  type NutritionDishItem,
  type Overrides,
} from "@/lib/messhub";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  writeBatch
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  CheckSquare, 
  Square, 
  Star, 
  Clock, 
  Sparkles, 
  History, 
  Edit3, 
  Utensils, 
  Megaphone,
  MessageSquare,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Flame,
  Dumbbell,
  Wheat,
  Calendar,
  ChefHat,
  FileSpreadsheet,
  Download
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Mess Control Dashboard — MessHub" },
      { name: "description", content: "Mess console with pending change tracking, Excel import, and audit history." },
    ],
  }),
  component: AdminGatekeeper,
});

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;

export interface AdminDishItem extends NutritionDishItem {
  servingSize?: string;
  specialTag?: string;
  recipe?: {
    ingredients?: string;
    method?: string;
  };
}

export type AdminDayMenu = {
  breakfast: AdminDishItem[];
  lunch: AdminDishItem[];
  snacks: AdminDishItem[];
  dinner: AdminDishItem[];
};

// Helper to recursively remove undefined values so Firestore never rejects payloads
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

async function logAdminActivity(messId: string, action: string, details: string) {
  if (!db) return;
  const firestoreDb = db;
  try {
    const session = getAdminSession();
    await addDoc(collection(firestoreDb, "admin_audit_logs"), {
      messId,
      action,
      details,
      operatorRole: session?.role || "admin",
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

function AdminGatekeeper() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const savedSession = getAdminSession();
    if (savedSession) {
      setSession(savedSession);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (session?.role === "super-admin") {
      navigate({ to: "/super-admin" });
    }
  }, [session, navigate]);

  function handleVerifyPasscode(e: React.FormEvent) {
    e.preventDefault();
    const matchedAuth = verifyAdminPasscode(passcode);

    if (matchedAuth) {
      setAuthError(false);
      const newSession = { role: matchedAuth.role, messId: matchedAuth.messId };
      saveAdminSession(newSession);
      setSession(newSession);
      if (matchedAuth.role === "super-admin") {
        navigate({ to: "/super-admin" });
      }
    } else {
      setAuthError(true);
      setPasscode("");
      if ("vibrate" in navigator) navigator.vibrate(200);
    }
  }

  if (!isHydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session || !session.messId) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between px-6 py-12 safe-top safe-bottom select-none font-sans">
        <header className="flex items-center justify-between w-full max-w-sm mx-auto">
          <Link to="/" className="text-sm font-semibold text-muted-foreground transition active:opacity-60">
            &larr; Exit to App
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40">Gateway</span>
        </header>

        <main className="w-full max-w-sm mx-auto text-center flex-1 flex flex-col justify-center">
          <div className="h-12 w-12 rounded-2xl bg-card shadow-card mx-auto flex items-center justify-center border border-border/40">
            <span className="text-muted-foreground font-bold">Secure</span>
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-foreground">Enter Mess Access Key</h1>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-[240px] mx-auto">
            Input the security authorization key issued to your specific dining facility.
          </p>

          <form onSubmit={handleVerifyPasscode} className="mt-8">
            <input
              autoFocus
              type="password"
              value={passcode}
              onChange={(e) => { setAuthError(false); setPasscode(e.target.value); }}
              placeholder="••••••••"
              className={`w-full tracking-widest text-center rounded-2xl border bg-card px-4 py-4 text-lg font-bold outline-none transition-all ${
                authError 
                  ? "border-destructive ring-4 ring-destructive/10" 
                  : "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
              }`}
            />
            {authError && (
              <p className="mt-2.5 text-xs font-semibold text-destructive animate-fade-in">
                Invalid key code sequence. Try again.
              </p>
            )}
            <button
              type="submit"
              disabled={passcode.length === 0}
              className="mt-4 w-full rounded-2xl gradient-warm py-4 text-sm font-bold text-white shadow-card active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer"
            >
              Unlock Dashboard
            </button>
          </form>
        </main>

        <footer className="text-center text-[10px] text-muted-foreground/50 font-medium tracking-wide">
          MESSHUB SECURE MANAGEMENT INTERFACE
        </footer>
      </div>
    );
  }

  return <LockedMessDashboard messId={session.messId} onSignOut={() => setSession(null)} />;
}

/* ---------------- Sidebar Dashboard Layout ---------------- */

function LockedMessDashboard({ messId, onSignOut }: { messId: MessId; onSignOut: () => void }) {
  const [overrides, setOverrides] = useState<Record<string, { label: string; menu: DayMenu }>>(() => {
    const raw = getOverrides(messId);
    return raw && typeof raw === "object" ? (raw as Record<string, { label: string; menu: DayMenu }>) : {};
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [showOverrideEditor, setShowOverrideEditor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"menu" | "overrides" | "broadcasts" | "feedback" | "audit">("menu");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedRecipeIndex, setExpandedRecipeIndex] = useState<string | null>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firestoreOverrides, setFirestoreOverrides] = useState<SpecialOverride[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [menu, setMenu] = useState<AdminDayMenu>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });
  const [initialLoadedMenu, setInitialLoadedMenu] = useState<AdminDayMenu | null>(null);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const mess = MESSES.find((m) => m.id === messId) || { id: messId, name: messId };

  const pendingSummary = useMemo(() => {
    if (!initialLoadedMenu) return [];
    const changes: { meal: string; text: string }[] = [];

    MEAL_TYPES.forEach((meal) => {
      const origList = (initialLoadedMenu[meal] || []).map((i) => i.name.trim());
      const curList = (menu[meal] || []).map((i) => i.name.trim());

      if (JSON.stringify(origList) !== JSON.stringify(curList)) {
        const added = curList.filter((x) => x && !origList.includes(x));
        const removed = origList.filter((x) => x && !curList.includes(x));

        if (added.length > 0) changes.push({ meal, text: `Added: ${added.join(", ")}` });
        if (removed.length > 0) changes.push({ meal, text: `Removed: ${removed.join(", ")}` });
        if (added.length === 0 && removed.length === 0 && origList.length === curList.length) {
          changes.push({ meal, text: `Modified dish details` });
        }
      }
    });

    return changes;
  }, [menu, initialLoadedMenu]);

  const hasUnsavedChanges = pendingSummary.length > 0;

  useEffect(() => {
    if (!db) return;
    const firestoreDb = db;
    const q = query(collection(firestoreDb, "mess_overrides"), where("messId", "==", messId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SpecialOverride[] = [];
      const overrideObj: Record<string, { label: string; menu: DayMenu }> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data() as SpecialOverride;
        list.push({ id: doc.id, ...data });
        overrideObj[data.date] = { label: data.label, menu: data.menu };
      });

      setFirestoreOverrides(list);
      setOverrides(overrideObj);
    });

    return () => unsubscribe();
  }, [messId]);

  useEffect(() => {
    if (!db) return;
    const firestoreDb = db;
    const auditQuery = query(
      collection(firestoreDb, "admin_audit_logs"),
      where("messId", "==", messId),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(auditQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Audit log order notice:", err);
    });

    return () => unsub();
  }, [messId]);

  // Load Menu strictly by selectedDate with race condition protection
  useEffect(() => {
    if (!db || !selectedDate || !messId) return;
    const firestoreDb = db;
    let isMounted = true;

    async function loadDailyMenu() {
      setIsLoadingMenu(true);
      try {
        const docId = `${messId}_${selectedDate}`;
        const dailyDocRef = doc(firestoreDb, "daily_menus", docId);
        const dailySnap = await getDoc(dailyDocRef);

        if (!isMounted) return;

        if (dailySnap.exists()) {
          const data = dailySnap.data();
          const formattedMenu: AdminDayMenu = {
            breakfast: (data.breakfast || []).map(sanitizeItem),
            lunch: (data.lunch || []).map(sanitizeItem),
            snacks: (data.snacks || []).map(sanitizeItem),
            dinner: (data.dinner || []).map(sanitizeItem),
          };
          setMenu(formattedMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(formattedMenu)));
        } else {
          const emptyMenu: AdminDayMenu = { breakfast: [], lunch: [], snacks: [], dinner: [] };
          setMenu(emptyMenu);
          setInitialLoadedMenu(JSON.parse(JSON.stringify(emptyMenu)));
        }
      } catch (err) {
        if (isMounted) console.error("Error loading daily menu from Firestore:", err);
      } finally {
        if (isMounted) setIsLoadingMenu(false);
      }
    }

    loadDailyMenu();

    return () => {
      isMounted = false;
    };
  }, [messId, selectedDate]);

  function sanitizeItem(item: any): AdminDishItem {
    if (typeof item === "string") {
      return {
        name: item,
        servingSize: "1 Portion",
        calories: 200,
        protein: 6,
        carbs: 25,
        fat: 5,
        saturatedFat: 1,
        fiber: 2,
        addedSugar: 0,
        recipe: { ingredients: "", method: "" },
        micronutrients: {
          iron: 0, calcium: 0, magnesium: 0, potassium: 0, sodium: 0, zinc: 0,
          vitaminA: 0, vitaminC: 0, vitaminB12: 0, folate: 0, vitaminD: 0, vitaminB6: 0
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
      calories: item.calories ?? 200,
      protein: item.protein ?? 6,
      carbs: item.carbs ?? 25,
      fat: item.fat ?? 5,
      saturatedFat: item.saturatedFat ?? 1,
      fiber: item.fiber ?? 2,
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

  const handleAddItem = (meal: keyof AdminDayMenu) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: [...prev[meal], { name: "", servingSize: "1 Portion", calories: 200, protein: 8, carbs: 25, fat: 5, recipe: { ingredients: "", method: "" } }],
    }));
  };

  const handleRemoveItem = (meal: keyof AdminDayMenu, index: number) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== index),
    }));
  };

  const handleItemFieldChange = (
    meal: keyof AdminDayMenu,
    index: number,
    field: keyof AdminDishItem,
    value: any
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      updatedMeal[index] = { ...updatedMeal[index], [field]: value };
      return { ...prev, [meal]: updatedMeal };
    });
  };

  async function handleSaveChanges() {
    if (!hasUnsavedChanges) {
      alert("ℹ️ No changes detected!\n\nYou have not modified any dishes.");
      return;
    }

    if (!db || !selectedDate) return;
    const firestoreDb = db;
    setIsSaving(true);

    try {
      const dailyDocRef = doc(firestoreDb, "daily_menus", `${messId}_${selectedDate}`);
      
      const payload = cleanFirestoreData({
        ...menu,
        messId,
        date: selectedDate,
        updatedAt: serverTimestamp(),
        updatedByRole: "admin",
      });

      await setDoc(dailyDocRef, payload, { merge: true });

      await logAdminActivity(
        messId, 
        "Menu Published", 
        `Updated dishes for date ${selectedDate}: ${pendingSummary.map(c => `${c.meal} (${c.text})`).join("; ")}`
      );

      setInitialLoadedMenu(JSON.parse(JSON.stringify(menu)));
      alert(`✅ Menu items and recipes for ${selectedDate} updated in Firebase and live in student apps!`);
    } catch (err: any) {
      console.error(err);
      alert(`An error occurred: ${err.message || "Failed to update Firestore."}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    const firestoreDb = db;
    setIsImportingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (!rows || rows.length === 0) {
        alert("The selected Excel file is empty.");
        return;
      }

      const groupedByDate: Record<string, AdminDayMenu> = {};
      let dishCount = 0;

      for (const row of rows) {
        const getVal = (...keys: string[]): any => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
            const foundKey = Object.keys(row).find(
              (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, "")
            );
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
              return row[foundKey];
            }
          }
          return undefined;
        };

        let rawDate = String(getVal("Date", "date") || "").trim();
        if (typeof row.Date === "number") {
          const dateObj = new Date(Math.floor(row.Date - 25569) * 86400 * 1000);
          rawDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
        } else if (rawDate.includes("/")) {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
            rawDate = `${y}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }

        const meal = String(getVal("Meal", "meal") || "").trim().toLowerCase() as MealKey;
        const dishName = String(getVal("DishName", "dishName", "Dish", "Items", "Item") || "").trim();

        if (!rawDate || !dishName || !MEAL_TYPES.includes(meal)) continue;

        if (!groupedByDate[rawDate]) {
          groupedByDate[rawDate] = { breakfast: [], lunch: [], snacks: [], dinner: [] };
        }

        const parseNum = (val: any, fallback: number): number => {
          if (val === undefined || val === null || val === "" || isNaN(Number(val))) return fallback;
          return Number(val);
        };

        groupedByDate[rawDate][meal].push({
          name: dishName,
          servingSize: String(getVal("ServingSize", "servingSize", "Serving") || "1 Portion").trim(),
          regionalTag: String(getVal("RegionalTag", "regionalTag", "Region") || "").trim(),
          specialTag: String(getVal("SpecialTag", "specialTag") || "").trim(),
          description: String(getVal("Description", "description") || "").trim(),
          originStory: String(getVal("OriginStory", "originStory") || "").trim(),
          funFact: String(getVal("FunFact", "funFact") || "").trim(),
          
          calories: parseNum(getVal("Calories", "calories", "Energy_kcal"), 200),
          protein: parseNum(getVal("Protein", "protein", "Protein_g"), 6),
          carbs: parseNum(getVal("Carbs", "carbs", "Carbs_g"), 25),
          fat: parseNum(getVal("Fat", "fat", "Fat_g"), 5),
          saturatedFat: parseNum(getVal("SatFat", "saturatedFat", "SatFat_g"), 1),
          fiber: parseNum(getVal("Fiber", "fiber", "Fiber_g"), 2),
          addedSugar: parseNum(getVal("Sugar", "addedSugar", "Sugar_g"), 0),

          recipe: {
            ingredients: String(getVal("RecipeIngredients", "recipeingredients", "Ingredients") || "").trim(),
            method: String(getVal("RecipeMethod", "recipemethod", "Method") || "").trim(),
          },

          micronutrients: {
            iron: parseNum(getVal("Iron", "iron_mg"), 0),
            calcium: parseNum(getVal("Calcium", "calcium_mg"), 0),
            magnesium: parseNum(getVal("Magnesium", "magnesium_mg"), 0),
            potassium: parseNum(getVal("Potassium", "potassium_mg"), 0),
            sodium: parseNum(getVal("Sodium", "sodium_mg"), 0),
            zinc: parseNum(getVal("Zinc", "zinc_mg"), 0),
            vitaminA: parseNum(getVal("VitA", "vitaminA", "vita_mcg"), 0),
            vitaminC: parseNum(getVal("VitC", "vitaminC", "vitc_mg"), 0),
            vitaminB12: parseNum(getVal("VitB12", "vitaminB12", "vitb12_mcg"), 0),
            folate: parseNum(getVal("Folate", "folate_mcg"), 0),
            vitaminD: parseNum(getVal("VitD", "vitaminD", "vitd_mcg"), 0),
            vitaminB6: parseNum(getVal("VitB6", "vitaminB6", "vitb6_mg"), 0),
          }
        });
        dishCount++;
      }

      const batch = writeBatch(firestoreDb);
      const dates = Object.keys(groupedByDate);

      for (const d of dates) {
        const docRef = doc(firestoreDb, "daily_menus", `${messId}_${d}`);
        const payload = cleanFirestoreData({
          ...groupedByDate[d],
          messId,
          date: d,
          updatedAt: serverTimestamp(),
          updatedByRole: "admin",
        });
        batch.set(docRef, payload, { merge: true });
      }

      await batch.commit();
      await logAdminActivity(messId, "Excel Menu Import", `Imported ${dishCount} dishes across ${dates.length} calendar days from Excel`);

      alert(`🎉 Successfully imported ${dishCount} dishes across ${dates.length} days into Firebase!`);
      
      if (groupedByDate[selectedDate]) {
        setMenu(groupedByDate[selectedDate]);
        setInitialLoadedMenu(JSON.parse(JSON.stringify(groupedByDate[selectedDate])));
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error parsing Excel: ${err.message || "Invalid spreadsheet structure."}`);
    } finally {
      setIsImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSendBroadcast() {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendBroadcast(messId, broadcastTitle.trim(), broadcastBody.trim());
      await logAdminActivity(messId, "Broadcast Sent", `Announcement: "${broadcastTitle.trim()}"`);
      setBroadcastTitle("");
      setBroadcastBody("");
      alert("Announcement broadcasted successfully!");
    } catch {
      alert("Failed to deliver announcement. Please check your network.");
    } finally {
      setIsBroadcasting(false);
    }
  }

  const overrideKeys = useMemo(() => Object.keys(overrides).sort(), [overrides]);

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

  const navItems = [
    { id: "menu", label: "Daily Menu Studio", icon: Utensils, badge: hasUnsavedChanges ? `${pendingSummary.length} Pending` : null },
    { id: "overrides", label: "Special Overrides", icon: Sparkles, count: overrideKeys.length },
    { id: "broadcasts", label: "Broadcast Notices", icon: Megaphone },
    { id: "feedback", label: "Student Feedback", icon: MessageSquare },
    { id: "audit", label: "Operations Log", icon: History, count: auditLogs.length },
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col md:flex-row select-none">
      
      {/* 📱 Mobile Top Appbar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-1.5 rounded-xl border border-border bg-background cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="font-bold text-sm leading-none">{mess.name}</h1>
            <span className="text-[10px] text-muted-foreground">Admin Console</span>
          </div>
        </div>

        <button
          onClick={() => { clearAdminSession(); onSignOut(); }}
          className="text-xs font-bold text-destructive flex items-center gap-1 border border-border px-2.5 py-1 rounded-xl cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </div>

      {/* 🧭 Desktop & Mobile Sidebar Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border p-5 flex flex-col justify-between transition-transform duration-200 ease-in-out
        md:translate-x-0 md:static md:w-72 shrink-0
        ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Authorized Station</p>
              <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>{mess.name}</span>
                {mess.subtitle && (
                  <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                    {mess.subtitle}
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg border border-border text-muted-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? "gradient-warm text-white shadow-card"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse shadow-xs">
                      {item.badge}
                    </span>
                  )}
                  {typeof item.count === "number" && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className={`w-3.5 h-3.5 ${hasUnsavedChanges ? "text-amber-500" : "text-emerald-500"}`} />
                Pending Changes
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                hasUnsavedChanges ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}>
                {hasUnsavedChanges ? `${pendingSummary.length} Changes` : "Synced"}
              </span>
            </div>

            {hasUnsavedChanges ? (
              <div className="mt-2.5 space-y-1.5">
                <p className="text-[11px] font-bold text-foreground">
                  Date: {selectedDate}
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {pendingSummary.map((change, idx) => (
                    <div key={idx} className="text-[10px] text-muted-foreground bg-muted/40 p-1.5 rounded-lg border border-border/40">
                      <span className="font-bold uppercase text-foreground">{change.meal}:</span> {change.text}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="w-full mt-2 gradient-warm text-white py-2 rounded-xl text-[11px] font-bold shadow-xs cursor-pointer active:scale-95 transition"
                >
                  {isSaving ? "Publishing..." : "Publish All Changes"}
                </button>
              </div>
            ) : (
              <p className="text-[11px] italic text-muted-foreground/70 mt-2">
                All daily menus are synced live with student apps.
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border space-y-2">
          <Link
            to="/"
            className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted transition"
          >
            <span>Live Student Feed</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => { clearAdminSession(); onSignOut(); }}
            className="w-full flex items-center gap-2 text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-2 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Lock Console</span>
          </button>
        </div>
      </aside>

      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <main className="flex-1 p-4 md:p-8 max-w-5xl overflow-y-auto">
        
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-5 rounded-3xl border border-border shadow-card">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {mess.name}
                  </span>
                  
                  <div className="flex items-center gap-1.5 ml-1 bg-background border border-border px-2.5 py-1 rounded-xl shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
                        if (e.target.value) setSelectedDate(e.target.value);
                      }}
                      className="bg-transparent text-[11px] font-bold text-foreground outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <h2 className="text-xl font-black text-foreground">Menu & Kitchen Studio</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View and manage menus by exact calendar date. Changes update the live student view for that day.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelImport}
                  className="hidden"
                  id="admin-excel-import"
                />
                <label
                  htmlFor="admin-excel-import"
                  className="px-3.5 py-2.5 rounded-2xl text-xs font-bold border border-border bg-background hover:bg-muted text-foreground transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>{isImportingExcel ? "Importing..." : "Import Excel / CSV"}</span>
                </label>

                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold shadow-card active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer ${
                    hasUnsavedChanges
                      ? "gradient-warm text-white"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Publishing..." : "Save & Update Students"}
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcomingDateOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (hasUnsavedChanges && !confirm("Switching dates will discard unsaved modifications. Continue?")) return;
                    setSelectedDate(opt.key);
                  }}
                  className={`shrink-0 rounded-2xl border px-4 py-2.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    selectedDate === opt.key
                      ? "border-transparent gradient-warm text-white shadow-card"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
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

            {isLoadingMenu ? (
              <div className="py-16 text-center text-xs font-bold text-muted-foreground bg-card rounded-3xl border border-border">
                Loading menu from database...
              </div>
            ) : (
              <div className="space-y-4">
                {MEAL_TYPES.map((mealType) => (
                  <div key={mealType} className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                        <span>🍽️</span> {mealType}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleAddItem(mealType)}
                        className="text-[11px] font-bold text-primary bg-background border border-border px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-muted/50 transition cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Dish
                      </button>
                    </div>

                    {menu[mealType].length === 0 ? (
                      <p className="text-xs italic text-muted-foreground/60 py-4 text-center">No dishes entered for {mealType} on {selectedDate}.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="hidden sm:flex items-center justify-between px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <span className="flex-1">Dish Name / Menu Item</span>
                          <span className="w-32 text-center">Serving Size</span>
                          <div className="flex items-center gap-2 pr-8">
                            <span className="w-16 text-center flex items-center justify-center gap-0.5"><Lock className="w-3 h-3 text-muted-foreground/60"/> Calories</span>
                            <span className="w-14 text-center">Protein</span>
                            <span className="w-14 text-center">Carbs</span>
                          </div>
                        </div>

                        {menu[mealType].map((item, idx) => {
                          const recipeKey = `${mealType}_${idx}`;
                          const isRecipeExpanded = expandedRecipeIndex === recipeKey;

                          return (
                            <div key={idx} className="bg-background border border-border p-3 rounded-2xl flex flex-col gap-2">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                <div className="w-full sm:flex-1">
                                  <input
                                    type="text"
                                    placeholder="Enter dish name..."
                                    value={item.name}
                                    onChange={(e) => handleItemFieldChange(mealType, idx, "name", e.target.value)}
                                    className="w-full bg-card border border-border px-3 py-2 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:border-primary shadow-xs"
                                  />
                                </div>

                                <div className="w-full sm:w-32">
                                  <input
                                    type="text"
                                    placeholder="1 Bowl (150g)"
                                    value={item.servingSize || ""}
                                    onChange={(e) => handleItemFieldChange(mealType, idx, "servingSize", e.target.value)}
                                    className="w-full bg-card border border-border px-2.5 py-2 rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:border-primary shadow-xs"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5 text-[10px] font-semibold select-none">
                                  <span className="bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-orange-600" /> {item.calories ?? 0} kcal
                                  </span>
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                                    <Dumbbell className="w-3 h-3 text-emerald-600" /> {item.protein ?? 0}g
                                  </span>
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                                    <Wheat className="w-3 h-3 text-amber-600" /> {item.carbs ?? 0}g
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRecipeIndex(isRecipeExpanded ? null : recipeKey)}
                                    className={`p-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                      isRecipeExpanded ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
                                    }`}
                                    title="View Kitchen Recipe"
                                  >
                                    <ChefHat className="w-3.5 h-3.5" />
                                    <span>{isRecipeExpanded ? "Hide" : "Recipe"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(mealType, idx)}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                    title="Delete Dish"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {isRecipeExpanded && (
                                <div className="mt-2 pt-2 border-t border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl">
                                  <div>
                                    <label className="block text-[9px] uppercase font-bold text-muted-foreground mb-1">
                                      Chef Standard Ingredients & Ratios
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={item.recipe?.ingredients || ""}
                                      onChange={(e) => {
                                        const r = { ...(item.recipe || {}), ingredients: e.target.value };
                                        handleItemFieldChange(mealType, idx, "recipe", r);
                                      }}
                                      placeholder="e.g. 10kg Rice, 2kg Paneer, Spices ratio..."
                                      className="w-full bg-card border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase font-bold text-muted-foreground mb-1">
                                      Cooking Guidelines & Prep Method
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={item.recipe?.method || ""}
                                      onChange={(e) => {
                                        const r = { ...(item.recipe || {}), method: e.target.value };
                                        handleItemFieldChange(mealType, idx, "recipe", r);
                                      }}
                                      placeholder="Step-by-step preparation method for kitchen team..."
                                      className="w-full bg-card border border-border rounded-xl p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
                                    />
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
          </div>
        )}

        {activeTab === "overrides" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-5 rounded-3xl border border-border shadow-card">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" /> Special Feast Overrides
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set up temporary menus with start and end times that automatically revert back.
                </p>
              </div>

              <button
                onClick={() => setShowOverrideEditor(selectedDate)}
                className="gradient-warm text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-card active:scale-95 transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Special Date
              </button>
            </div>

            <div className="space-y-3">
              {overrideKeys.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center text-xs text-muted-foreground font-medium">
                  No special overrides scheduled. The standard menu schedule is currently active.
                </div>
              ) : (
                overrideKeys.map((k) => {
                  const o = overrides[k];
                  const firestoreData = firestoreOverrides.find((fo) => fo.date === k);
                  const date = new Date(k + "T00:00:00");
                  const isExpired = firestoreData?.expiresAt ? new Date(firestoreData.expiresAt) < new Date() : false;

                  return (
                    <div key={k} className="rounded-3xl border border-border bg-card p-5 shadow-card">
                      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-2 flex-wrap">
                            <span>{date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                            {firestoreData && (
                              isExpired ? (
                                <span className="text-[9px] bg-red-100 text-red-700 font-bold px-2.5 py-0.5 rounded-full">
                                  Expired
                                </span>
                              ) : (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-emerald-600" /> Active: {firestoreData.startTime} - {firestoreData.endTime}
                                </span>
                              )
                            )}
                          </div>
                          <div className="text-xs text-primary font-bold mt-1">Special: {o.label}</div>
                        </div>

                        <div className="flex gap-2 self-end sm:self-center">
                          <button
                            onClick={() => setShowOverrideEditor(k)}
                            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted transition cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete special override for ${k}?`)) return;
                              await deleteFirestoreOverride(messId, k);
                              await logAdminActivity(messId, "Override Removed", `Deleted special override for date: ${k}`);
                              const next = { ...overrides };
                              delete next[k];
                              setOverrides(next);
                              saveOverrides(messId, next);
                            }}
                            className="rounded-xl border border-destructive/40 bg-background px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "broadcasts" && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-primary" /> Broadcast Mess Notice
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends instant notifications and banner popups to all registered students.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. Lunch timings extended by 30 minutes"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Message Details & Links
                  </label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder="Add operational notes or instructions..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <button 
                  onClick={handleSendBroadcast}
                  disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastBody.trim()}
                  className="w-full gradient-warm text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-card active:scale-95 transition disabled:opacity-40 cursor-pointer"
                >
                  {isBroadcasting ? "Broadcasting Notice..." : "Broadcast Live Notice"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="max-w-2xl mx-auto">
            <AdminDishFeedbackViewer messId={messId} />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div>
                  <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Operations Activity Feed
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Live record of all menu edits, overrides, and broadcast transmissions.
                  </p>
                </div>
                <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                  {auditLogs.length} Events
                </span>
              </div>

              <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground/60 py-8 text-center">No recent operator logs recorded.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-background border border-border/80 rounded-2xl flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{log.action}</span>
                          <span className="text-[9px] font-bold uppercase bg-muted text-muted-foreground px-1.5 py-0.2 rounded">
                            {log.operatorRole || "admin"}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] font-medium">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 font-semibold shrink-0">
                        {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {showOverrideEditor && (
        <OverrideEditor
          initialKey={showOverrideEditor}
          existing={overrides[showOverrideEditor]}
          existingOverrideData={firestoreOverrides.find(fo => fo.date === showOverrideEditor)}
          weeklyFallback={{}}
          onCancel={() => setShowOverrideEditor(null)}
          onSave={async (k, val) => {
            const next = { ...overrides, [k]: { label: val.label, menu: val.menu } };
            setOverrides(next);
            saveOverrides(messId, next);

            await saveFirestoreOverride(messId, {
              messId,
              date: k,
              label: val.label,
              startTime: val.startTime || "07:30",
              endTime: val.endTime || "22:00",
              expiresAt: new Date(`${k}T${val.endTime || "22:00"}:00`).toISOString(),
              menu: val.menu,
            });

            await logAdminActivity(
              messId,
              "Override Published",
              `Set "${val.label}" on ${k} (${val.startTime} - ${val.endTime})`
            );

            setShowOverrideEditor(null);
          }}
        />
      )}
    </div>
  );
}

function AdminDishFeedbackViewer({ messId }: { messId: MessId }) {
  const [feedbacks, setFeedbacks] = useState<ItemFeedback[]>([]);
  const [filter, setFilter] = useState<"all" | "unsolved" | "solved">("all");

  useEffect(() => {
    if (!db) return;
    const firestoreDb = db;
    let fallbackUnsub: (() => void) | null = null;

    const indexedQuery = query(
      collection(firestoreDb, "item_feedback"),
      where("messId", "==", messId),
      orderBy("createdAt", "desc")
    );

    const primaryUnsub = onSnapshot(
      indexedQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemFeedback));
        setFeedbacks(list);
      },
      (err) => {
        console.warn("[Firestore] Index fallback sorting:", err);
        const fallbackQuery = query(
          collection(firestoreDb, "item_feedback"),
          where("messId", "==", messId)
        );
        fallbackUnsub = onSnapshot(fallbackQuery, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemFeedback));
          list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setFeedbacks(list);
        });
      }
    );

    return () => {
      primaryUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [messId]);

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === "unsolved") return f.status === "unsolved";
    if (filter === "solved") return f.status === "solved";
    return true;
  });

  function exportFeedbackToExcel() {
    if (feedbacks.length === 0) {
      alert("No feedback records available to export.");
      return;
    }

    const exportRows = feedbacks.map((f) => ({
      "Date / Time": f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString("en-IN") : "Recent",
      "Student Name": f.studentName,
      "Student Email": f.studentEmail || "",
      "Meal": f.mealKey,
      "Dish Name": f.itemName,
      "Rating (Out of 5)": f.rating,
      "Feedback Comment": f.comment || "",
      "Resolution Status": f.status === "solved" ? "Resolved" : "Pending"
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FeedbackReports");
    XLSX.writeFile(wb, `MessHub_Feedback_${messId}_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-5 shadow-card space-y-4 font-sans select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <span>🍲</span> Student Dish Reports ({feedbacks.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student ratings and food quality logs submitted for this facility.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportFeedbackToExcel}
            className="text-xs font-bold text-slate-700 bg-background hover:bg-muted border border-border px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export to Excel
          </button>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
            {(["all", "unsolved", "solved"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                  filter === type
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFeedbacks.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/60 text-center py-8">
          No {filter !== "all" ? filter : ""} feedback records found.
        </p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredFeedbacks.map((item) => {
            const isSolved = item.status === "solved";

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                  isSolved
                    ? "bg-muted/40 border-border opacity-60 grayscale-[30%]"
                    : "bg-background border-border shadow-xs"
                }`}
              >
                <button
                  type="button"
                  onClick={async () => {
                    if (!item.id) return;
                    await toggleFeedbackStatus(item.id, item.status);
                    await logAdminActivity(
                      messId, 
                      "Feedback Toggle", 
                      `Toggled feedback for '${item.itemName}' to ${isSolved ? 'Unsolved' : 'Solved'}`
                    );
                  }}
                  className="mt-0.5 text-primary hover:scale-110 transition cursor-pointer shrink-0"
                  title={isSolved ? "Mark as Unsolved" : "Mark as Solved"}
                >
                  {isSolved ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-bold text-xs truncate ${isSolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.itemName}{" "}
                      <span className="uppercase text-[9px] text-muted-foreground font-semibold no-underline inline-block">
                        ({item.mealKey})
                      </span>
                    </span>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= item.rating
                              ? isSolved ? "fill-gray-400 text-gray-400" : "fill-amber-500 text-amber-500"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground font-medium">
                    👤 {item.studentName} {item.studentEmail ? `(${item.studentEmail})` : ""}
                  </div>

                  {item.comment && (
                    <p className={`text-xs italic p-2 rounded-xl border mt-1 ${isSolved ? "line-through text-muted-foreground bg-muted border-border" : "text-foreground bg-card border-border/80"}`}>
                      "{item.comment}"
                    </p>
                  )}

                  <div className="pt-1 flex items-center justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Pending Action
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OverrideEditor({ 
  initialKey, 
  existing, 
  existingOverrideData,
  onCancel, 
  onSave 
}: {
  initialKey: string; 
  existing?: { label: string; menu: DayMenu }; 
  existingOverrideData?: SpecialOverride;
  weeklyFallback: any; 
  onCancel: () => void; 
  onSave: (k: string, v: { label: string; menu: DayMenu; startTime: string; endTime: string }) => void;
}) {
  const [dateStr, setDateStr] = useState(initialKey);
  const [label, setLabel] = useState(existing?.label ?? "Special menu");
  const [startTime, setStartTime] = useState(existingOverrideData?.startTime || "07:30");
  const [endTime, setEndTime] = useState(existingOverrideData?.endTime || "22:00");
  const initialMenu: DayMenu = existing?.menu ?? { breakfast: [], lunch: [], snacks: [], dinner: [] };
  const [menu, setMenu] = useState<DayMenu>(initialMenu);

  function setItems(meal: MealKey, text: string) {
    setMenu({ ...menu, [meal]: text.split("\n").map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center font-sans" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer" />
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 shadow-elevated sm:max-h-[85vh] sm:rounded-3xl border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{existing ? "Edit override" : "Add special date"}</h3>
          <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-lg cursor-pointer">×</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Label (e.g. Festival Name)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 60))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 bg-muted/40 p-3 rounded-2xl border border-border/60">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-primary tracking-wider">Start Time</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-primary tracking-wider">End Time (Reverts automatically)</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MEAL_DEFS.map((m) => (
            <div key={m.key} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </div>
              <textarea
                rows={5}
                value={(menu[m.key] || []).join("\n")}
                onChange={(e) => setItems(m.key, e.target.value)}
                placeholder="One item per line"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary font-medium"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground cursor-pointer">
            Cancel 
          </button>
          <button
            onClick={() => {
              if (!dateStr || !label.trim()) return;
              onSave(dateStr, { label: label.trim(), menu, startTime, endTime });
            }}
            className="rounded-xl gradient-warm px-4 py-2 text-xs font-bold text-white shadow-card cursor-pointer"
          >
            Save override
          </button>
        </div>
      </div>
    </div>
  );
}