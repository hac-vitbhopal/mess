import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  DEFAULT_WEEKLY,
  MEAL_DEFS,
  MESSES,
  dateKey,
  formatTime,
  getOverrides,
  saveOverrides,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  ADMIN_AUTH_KEYS,
  sendBroadcast,
  getDynamicMessMenu,
  saveDynamicMessMenu,
  HARDCODED_WEEKLY_MENUS,
  toggleFeedbackStatus,
  type DayMenu,
  type MealKey,
  type MessId,
  type Overrides,
  type DayMenuWithNutrition,
  type MenuItemWithNutrition,
  type ItemFeedback,
} from "@/lib/messhub";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Plus, Trash2, Save, CheckCircle2, AlertCircle, Lock, CheckSquare, Square, Star } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Mess Control Gateway — MessHub" },
      { name: "description", content: "Secure authentication gateway for mess operators." },
    ],
  }),
  component: AdminGatekeeper,
});

const WEEKDAYS = [
  { i: 1, name: "Monday" },
  { i: 2, name: "Tuesday" },
  { i: 3, name: "Wednesday" },
  { i: 4, name: "Thursday" },
  { i: 5, name: "Friday" },
  { i: 6, name: "Saturday" },
  { i: 0, name: "Sunday" },
];

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;

function AdminGatekeeper() {
  const navigate = useNavigate();
  // Start session as null on initial SSR render
  const [session, setSession] = useState<any>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  // Read saved session ONLY on client mount to match SSR
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
    const cleanKey = passcode.trim();
    const matchedAuth = ADMIN_AUTH_KEYS[cleanKey];

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

  // Prevent flash before hydration completes
  if (!isHydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  // Phase 1: Lockscreen Gate
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

/* ---------------- Concrete Isolated Dashboard View ---------------- */

function LockedMessDashboard({ messId, onSignOut }: { messId: MessId; onSignOut: () => void }) {
  const [overrides, setOverrides] = useState<Overrides>(() => getOverrides(messId));
  const [activeDay, setActiveDay] = useState<number>(() => new Date().getDay());
  const [showOverrideEditor, setShowOverrideEditor] = useState<string | null>(null);
  
  // Dynamic Nutrition Menu States
  const [menu, setMenu] = useState<DayMenuWithNutrition>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Broadcast States
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const mess = MESSES.find((m) => m.id === messId)!;

  // ⚡ Load Menu & Nutrition Macros whenever Mess or Day changes
  useEffect(() => {
    async function load() {
      setIsLoadingMenu(true);
      setHasUnsavedChanges(false);

      const data = await getDynamicMessMenu(messId, activeDay);

      if (data && (data.breakfast?.length > 0 || data.lunch?.length > 0 || data.dinner?.length > 0)) {
        setMenu(data);
      } else {
        // Fallback to static hardcoded matrix
        const defaultMenu = HARDCODED_WEEKLY_MENUS[messId]?.[activeDay];
        if (defaultMenu) {
          setMenu({
            breakfast: (defaultMenu.breakfast || []).map((name) => ({ name, calories: 200, protein: 6, carbs: 25, fat: 5 })),
            lunch: (defaultMenu.lunch || []).map((name) => ({ name, calories: 350, protein: 12, carbs: 45, fat: 8 })),
            snacks: (defaultMenu.snacks || []).map((name) => ({ name, calories: 180, protein: 4, carbs: 22, fat: 6 })),
            dinner: (defaultMenu.dinner || []).map((name) => ({ name, calories: 400, protein: 15, carbs: 50, fat: 10 })),
          });
        } else {
          setMenu({ breakfast: [], lunch: [], snacks: [], dinner: [] });
        }
      }

      setIsLoadingMenu(false);
    }
    load();
  }, [messId, activeDay]);

  const handleAddItem = (meal: keyof DayMenuWithNutrition) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: [...prev[meal], { name: "", calories: 200, protein: 8, carbs: 25, fat: 5 }],
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (meal: keyof DayMenuWithNutrition, index: number) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== index),
    }));
    setHasUnsavedChanges(true);
  };

  // Only allows updating dish name for admins
  const handleItemNameChange = (
    meal: keyof DayMenuWithNutrition,
    index: number,
    value: string
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      updatedMeal[index] = { ...updatedMeal[index], name: value };
      return { ...prev, [meal]: updatedMeal };
    });
    setHasUnsavedChanges(true);
  };

  async function handleSaveChanges() {
    if (!hasUnsavedChanges) {
      alert("ℹ️ No changes detected!\n\nYou haven't modified any menu items.");
      return;
    }

    setIsSaving(true);
    try {
      await saveDynamicMessMenu(messId, activeDay, menu);
      setHasUnsavedChanges(false);
      alert(`✅ Menu items updated in Firebase and published to student feeds!`);
    } catch {
      alert("An error occurred while deploying updates. Check network stability.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendBroadcast() {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendBroadcast(messId, broadcastTitle.trim(), broadcastBody.trim());
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

  return (
    <div className="min-h-screen bg-background pb-16 font-sans">
      <header className="safe-top border-b border-border bg-card/60 px-5 pb-4 pt-3 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Authorized Portal · {mess.name}{mess.subtitle ? ` (${mess.subtitle})` : ""}
            </p>
            <h1 className="truncate text-xl font-bold text-foreground">Weekly Menu Console</h1>
          </div>
          <button
            onClick={() => { clearAdminSession(); onSignOut(); }}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold shadow-card transition active:scale-95 cursor-pointer"
          >
            Lock Console
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {/* Weekly menu editor */}
        <section className="mt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Weekly Menu Items</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Edit dish names for your mess. Macros are managed by the Nutritionist.</p>
            </div>
          </div>

          {/* Weekday Selector */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {WEEKDAYS.map((d) => (
              <button
                key={d.i}
                onClick={() => {
                  if (hasUnsavedChanges && !confirm("Discard unsaved changes and switch day?")) return;
                  setActiveDay(d.i);
                }}
                className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium transition cursor-pointer ${
                  activeDay === d.i
                    ? "border-transparent gradient-warm text-white shadow-card"
                    : "border-border bg-white text-muted-foreground"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Unsaved Changes Status Bar */}
          <div className="flex items-center justify-between mt-3 mb-4">
            <span className="text-xs font-bold text-muted-foreground">
              Editing: <span className="underline text-foreground">{WEEKDAYS.find(w => w.i === activeDay)?.name}</span>
            </span>

            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
                <AlertCircle className="w-3 h-3 text-amber-600" /> Unsaved Changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> All Saved
              </span>
            )}
          </div>

          {/* Meals List */}
          {isLoadingMenu ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground">Loading menu items...</div>
          ) : (
            <div className="space-y-4">
              {MEAL_TYPES.map((mealType) => (
                <div key={mealType} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <span>🍽️</span> {mealType}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddItem(mealType)}
                      className="text-[11px] font-bold text-primary bg-background border border-border px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-muted/50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Dish
                    </button>
                  </div>

                  {menu[mealType].length === 0 ? (
                    <p className="text-[11px] italic text-muted-foreground/60 py-2 text-center">No dishes configured for {mealType}.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Column Labels */}
                      <div className="hidden sm:flex items-center justify-between px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span className="flex-1">Dish Name / Menu Item</span>
                        <div className="flex items-center gap-2 pr-8">
                          <span className="w-16 text-center flex items-center justify-center gap-0.5"><Lock className="w-3 h-3 text-muted-foreground/60"/> Calories</span>
                          <span className="w-14 text-center">Protein</span>
                          <span className="w-14 text-center">Carbs</span>
                        </div>
                      </div>

                      {menu[mealType].map((item, idx) => (
                        <div key={idx} className="bg-background border border-border p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                          
                          {/* Dish Name (Editable) */}
                          <div className="w-full sm:flex-1">
                            <label className="block sm:hidden text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Dish Name</label>
                            <input
                              type="text"
                              placeholder="Dish Name"
                              value={item.name}
                              onChange={(e) => handleItemNameChange(mealType, idx, e.target.value)}
                              className="w-full bg-white border border-border px-3 py-1.5 rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                            />
                          </div>

                          {/* 🔒 READ-ONLY NUTRITION MACROS (Managed by Nutritionist) */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold flex-wrap w-full sm:w-auto select-none opacity-85">
                            <span className="bg-orange-50 text-orange-800 border border-orange-200 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                              🔥 {item.calories ?? 0} kcal
                            </span>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                              💪 {item.protein ?? 0}g Pro
                            </span>
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                              🌾 {item.carbs ?? 0}g Carb
                            </span>
                          </div>

                          {/* Delete Dish Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(mealType, idx)}
                            className="text-red-500 hover:text-red-700 p-1 self-end sm:self-center cursor-pointer"
                            title="Delete Dish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Global Save Action Button */}
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className={`mt-6 w-full rounded-2xl py-4 text-sm font-bold shadow-card active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 ${
            hasUnsavedChanges
              ? "gradient-warm text-white"
              : "bg-gray-100 text-gray-400 border border-gray-300"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Publishing Updates..." : "Save & Update Student Portal"}
        </button>

        {/* Special date overrides */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Special date overrides</h2>
              <p className="text-sm text-muted-foreground">Festivals or one-off menus. Falls back to the weekly menu when no override exists.</p>
            </div>
            <button
              onClick={() => setShowOverrideEditor(dateKey(new Date()))}
              className="rounded-full gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-card cursor-pointer"
            >
              + Add override
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {overrideKeys.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground font-medium">
                No special overrides. The weekly menu is used for every date.
              </div>
            )}
            {overrideKeys.map((k) => {
              const o = overrides[k];
              const date = new Date(k + "T00:00:00");
              return (
                <div key={k} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground">
                        {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                      </div>
                      <div className="text-xs text-primary font-semibold mt-0.5">Special: {o.label}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOverrideEditor(k)}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition active:bg-background cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Delete this override?")) return;
                          const next = { ...overrides };
                          delete next[k];
                          setOverrides(next);
                          saveOverrides(messId, next);
                        }}
                        className="rounded-full border border-destructive/40 bg-white px-3 py-1.5 text-xs font-medium text-destructive transition active:bg-destructive/5 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Broadcast layout module */}
        <section className="mt-10">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card w-full">
            <h3 className="font-bold text-foreground text-base tracking-tight">Broadcast an announcement</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">This updates your students' notification feeds instantly.</p>
            
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Heading (e.g., Timing Extension)"
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary transition"
            />
            
            <textarea
              rows={3}
              maxLength={500}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Message text goes here..."
              className="mt-2.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary transition"
            />
            
            <button 
              onClick={handleSendBroadcast}
              disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastBody.trim()}
              className="mt-3 w-full rounded-xl gradient-warm px-4 py-2 text-xs font-bold text-white shadow-card active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              {isBroadcasting ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </section>

        {/* 🍲 ⚡ STUDENT DISH FEEDBACK MANAGEMENT (Filtered for this Mess) */}
        <section className="mt-10">
          <AdminDishFeedbackViewer messId={messId} />
        </section>
      </main>

      {showOverrideEditor && (
        <OverrideEditor
          initialKey={showOverrideEditor}
          existing={overrides[showOverrideEditor]}
          weeklyFallback={{}}
          onCancel={() => setShowOverrideEditor(null)}
          onSave={(k, val) => {
            const next = { ...overrides, [k]: val };
            setOverrides(next);
            saveOverrides(messId, next);
            setShowOverrideEditor(null);
          }}
        />
      )}
    </div>
  );
}

{/* 🍲 ⚡ COMPONENT: Admin Dish Feedback Viewer with Solved/Unsolved Toggle */}
{/* 🍲 COMPONENT: Admin Dish Feedback Viewer with Solved Visual Styling */}
function AdminDishFeedbackViewer({ messId }: { messId: MessId }) {
  const [feedbacks, setFeedbacks] = useState<ItemFeedback[]>([]);
  const [filter, setFilter] = useState<"all" | "unsolved" | "solved">("all");

  useEffect(() => {
    if (!db) return;

    // Scalable query with index error fallback
    const indexedQuery = query(
      collection(db, "item_feedback"),
      where("messId", "==", messId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      indexedQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemFeedback));
        setFeedbacks(list);
      },
      (err) => {
        console.warn("[Firestore] Index pending, using fallback memory sort:", err);
        const fallbackQuery = query(
          collection(db, "item_feedback"),
          where("messId", "==", messId)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemFeedback));
          list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setFeedbacks(list);
        });
      }
    );

    return () => unsub();
  }, [messId]);

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === "unsolved") return f.status === "unsolved";
    if (filter === "solved") return f.status === "solved";
    return true;
  });

  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card space-y-4 font-sans select-none">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <span>🍲</span> Student Dish Feedback ({feedbacks.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time quality feedback submitted by students for this mess facility.
          </p>
        </div>

        {/* Filter Toggle Buttons */}
        <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
          {(["all", "unsolved", "solved"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                filter === type
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Items List */}
      {filteredFeedbacks.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/60 text-center py-8">
          No {filter !== "all" ? filter : ""} feedback entries logged yet.
        </p>
      ) : (
        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
          {filteredFeedbacks.map((item) => {
            const isSolved = item.status === "solved";

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  isSolved
                    ? "bg-emerald-50/40 border-emerald-300 opacity-60 grayscale-[25%]" // ⚡ Solved Style: Faded + Green Border
                    : "bg-background border-border shadow-xs" // Active Pending Style
                }`}
              >
                {/* Solved/Unsolved Status Tick Checkbox */}
                <button
                  type="button"
                  onClick={() => item.id && toggleFeedbackStatus(item.id, item.status)}
                  className="mt-0.5 text-primary hover:scale-110 transition cursor-pointer shrink-0"
                  title={isSolved ? "Mark as Unsolved" : "Mark as Solved"}
                >
                  {isSolved ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Dish Name & Rating */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-bold text-xs truncate ${
                        isSolved ? "line-through text-muted-foreground" : "text-foreground" // ⚡ Crossed out text if solved
                      }`}
                    >
                      {item.itemName}{" "}
                      <span className="uppercase text-[9px] text-muted-foreground font-semibold no-underline inline-block">
                        ({item.mealKey})
                      </span>
                    </span>

                    {/* Star Rating Display */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= item.rating
                              ? isSolved
                                ? "fill-gray-400 text-gray-400"
                                : "fill-amber-500 text-amber-500"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Student Details */}
                  <div className="text-[10px] text-muted-foreground font-medium">
                    👤 {item.studentName} {item.studentEmail ? `(${item.studentEmail})` : ""}
                  </div>

                  {/* Comment */}
                  {item.comment && (
                    <p
                      className={`text-xs italic p-2 rounded-lg border mt-1 ${
                        isSolved
                          ? "line-through text-muted-foreground bg-gray-100/60 border-gray-200"
                          : "text-foreground bg-white border-border/80"
                      }`}
                    >
                      "{item.comment}"
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="pt-1 flex items-center justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Solved & Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Pending Resolution
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

function OverrideEditor({ initialKey, existing, onCancel, onSave }: {
  initialKey: string; existing?: { label: string; menu: DayMenu }; weeklyFallback: any; onCancel: () => void; onSave: (k: string, v: { label: string; menu: DayMenu }) => void;
}) {
  const [dateStr, setDateStr] = useState(initialKey);
  const [label, setLabel] = useState(existing?.label ?? "Special menu");
  const initialMenu: DayMenu = existing?.menu ?? DEFAULT_WEEKLY[0];
  const [menu, setMenu] = useState<DayMenu>(initialMenu);

  function setItems(meal: MealKey, text: string) {
    setMenu({ ...menu, [meal]: text.split("\n").map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center font-sans" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-elevated sm:max-h-[85vh] sm:rounded-3xl border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{existing ? "Edit override" : "Add special date"}</h3>
          <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-lg cursor-pointer" aria-label="Close">×</button>
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
                className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary font-medium"
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
              onSave(dateStr, { label: label.trim(), menu });
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