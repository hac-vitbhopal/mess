import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  MESSES, 
  saveDynamicMessMenu, 
  getDynamicMessMenu, 
  ADMIN_AUTH_KEYS,
  HARDCODED_WEEKLY_MENUS,
  seedAllMenusToFirestore,
  type MessId, 
  type DayMenuWithNutrition, 
  type MenuItemWithNutrition 
} from "@/lib/messhub";
import { Flame, Lock, LogOut, Plus, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/nutritionist")({
  head: () => ({
    meta: [
      { title: "Nutritionist Portal — MessHub VIT Bhopal" },
    ],
  }),
  component: NutritionistPortalPage,
});

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;

function NutritionistPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [selectedMess, setSelectedMess] = useState<MessId>("jmb");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // ⚡ Unsaved Changes Tracker State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [menu, setMenu] = useState<DayMenuWithNutrition>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });

  // Check saved session on load
  useEffect(() => {
    const savedRole = localStorage.getItem("messhub.nutritionist.auth");
    if (savedRole === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch dynamic menu whenever selected Mess or Day changes
// Fetch dynamic menu directly from Firestore for the selected Mess and Day
  useEffect(() => {
    if (!isAuthenticated) return;

    async function load() {
      setIsLoading(true);
      setHasUnsavedChanges(false); // Reset dirty state on view switch
      
      // 1. Fetch live document from Firestore
      const firestoreData = await getDynamicMessMenu(selectedMess, selectedDay);
      
      if (firestoreData) {
        // Ensure every item has calorie/protein/carb fields formatted correctly
        const sanitizedMenu: DayMenuWithNutrition = {
          breakfast: (firestoreData.breakfast || []).map((item: any) => 
            typeof item === "string" 
              ? { name: item, calories: 200, protein: 6, carbs: 25, fat: 5 } 
              : { calories: 200, protein: 6, carbs: 25, fat: 5, ...item }
          ),
          lunch: (firestoreData.lunch || []).map((item: any) => 
            typeof item === "string" 
              ? { name: item, calories: 350, protein: 12, carbs: 45, fat: 8 } 
              : { calories: 350, protein: 12, carbs: 45, fat: 8, ...item }
          ),
          snacks: (firestoreData.snacks || []).map((item: any) => 
            typeof item === "string" 
              ? { name: item, calories: 180, protein: 4, carbs: 22, fat: 6 } 
              : { calories: 180, protein: 4, carbs: 22, fat: 6, ...item }
          ),
          dinner: (firestoreData.dinner || []).map((item: any) => 
            typeof item === "string" 
              ? { name: item, calories: 400, protein: 15, carbs: 50, fat: 10 } 
              : { calories: 400, protein: 15, carbs: 50, fat: 10, ...item }
          ),
        };

        setMenu(sanitizedMenu);
      } else {
        // If no Firestore entry exists for this day/mess yet
        setMenu({ breakfast: [], lunch: [], snacks: [], dinner: [] });
      }

      setIsLoading(false);
    }
    load();
  }, [selectedMess, selectedDay, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const match = ADMIN_AUTH_KEYS[passwordInput.trim()];

    if (match && (match.role === "nutritionist" || match.role === "super-admin")) {
      setIsAuthenticated(true);
      localStorage.setItem("messhub.nutritionist.auth", "true");
      setAuthError("");
    } else {
      setAuthError("Invalid Nutritionist Access Key!");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("messhub.nutritionist.auth");
  };

  const handleAddItem = (meal: keyof DayMenuWithNutrition) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: [...prev[meal], { name: "", calories: 200, protein: 8, carbs: 25, fat: 5 }],
    }));
    setHasUnsavedChanges(true); // ⚡ Flag unsaved changes
  };

  const handleRemoveItem = (meal: keyof DayMenuWithNutrition, index: number) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== index),
    }));
    setHasUnsavedChanges(true); // ⚡ Flag unsaved changes
  };

  const handleItemChange = (
    meal: keyof DayMenuWithNutrition,
    index: number,
    field: keyof MenuItemWithNutrition,
    value: string | number
  ) => {
    setMenu((prev) => {
      const updatedMeal = [...prev[meal]];
      updatedMeal[index] = { ...updatedMeal[index], [field]: value };
      return { ...prev, [meal]: updatedMeal };
    });
    setHasUnsavedChanges(true); // ⚡ Flag unsaved changes
  };

  const handleSave = async () => {
    // 🛑 Pop up if NO changes were made
    if (!hasUnsavedChanges) {
      alert("ℹ️ No changes detected!\n\nYou haven't modified any dish items or macro values.");
      return;
    }

    setIsSaving(true);
    try {
      await saveDynamicMessMenu(selectedMess, selectedDay, menu);
      setHasUnsavedChanges(false); // Reset flag on successful save
      alert(`✅ Changes Published Successfully!\n\nThe updated menu & macros for ${DAYS_OF_WEEK[selectedDay]} have been saved to Firestore.`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update Firebase. Please check your network connection.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------------- 🔒 LOGIN SCREEN ---------------- */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FFF8F5] flex items-center justify-center px-5 font-sans select-none">
        <div className="w-full max-w-sm bg-white border-2 border-[#FFEDD5] rounded-3xl p-6 shadow-xl text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#FF6B2C] to-[#EA580C] rounded-2xl flex items-center justify-center mx-auto text-white shadow-md shadow-[#F97316]/30 mb-4">
            <Lock className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-black text-[#221510]">Nutritionist Access</h1>
          <p className="text-xs text-[#C2410C]/80 mt-1 font-medium">VIT Bhopal Mess Platform</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Passkey (e.g. VITBNutri@2026)"
                className="w-full bg-[#FFF8F5] border-2 border-[#FFEDD5] rounded-2xl px-4 py-3 text-xs font-bold text-[#221510] placeholder-[#D4A391] focus:outline-none focus:border-[#F97316]"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#FF6B2C] to-[#EA580C] text-white font-bold py-3 rounded-2xl shadow-lg shadow-[#F97316]/25 hover:opacity-95 active:scale-[0.99] transition text-xs"
            >
              Unlock Editor
            </button>
          </form>

          <p className="mt-6 text-[10px] text-[#C2410C]/60 font-semibold">
            <Link to="/" className="underline hover:text-[#F97316]">
              &larr; Back to MessHub
            </Link>
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- 🥗 NUTRITIONIST DASHBOARD ---------------- */
  return (
    <div className="min-h-screen bg-[#FFF8F5] text-[#221510] px-4 py-6 max-w-4xl mx-auto font-sans select-none">
      
      {/* Top Bar */}
      {/* Top Bar Header */}
<header className="flex items-center justify-between pb-4 border-b border-[#FFEDD5]">
  <div className="flex items-center gap-2">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B2C] to-[#EA580C] flex items-center justify-center text-white shadow-md">
      <Flame className="w-5 h-5" />
    </div>
    <div>
      <h1 className="text-base sm:text-lg font-black text-[#221510]">Nutritionist Portal</h1>
      <p className="text-[10px] font-bold text-[#C2410C]">VIT Bhopal Campus Utility</p>
    </div>
  </div>

  {/* ⚡ Action Buttons */}
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => {
        if (confirm("Populate all 6 messes & 7 days with default nutrition macros?")) {
          seedAllMenusToFirestore();
        }
      }}
      className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-100 transition cursor-pointer"
    >
      ⚡ Seed All Menus
    </button>

    <button
      onClick={handleLogout}
      className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-red-100 transition"
    >
      <LogOut className="w-3.5 h-3.5" /> Logout
    </button>
  </div>
</header>

      {/* Control Bar: Select Mess & Day */}
      <div className="bg-white border-2 border-[#FFEDD5] rounded-2xl p-4 my-5 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider mb-1">
            Select Mess Facility
          </label>
          <select
            value={selectedMess}
            onChange={(e) => {
              if (hasUnsavedChanges && !confirm("You have unsaved changes! Discard them and switch mess?")) return;
              setSelectedMess(e.target.value as MessId);
            }}
            className="w-full bg-[#FFF8F5] border-2 border-[#FFEDD5] rounded-xl px-3 py-2 text-xs font-bold text-[#221510] focus:outline-none focus:border-[#F97316]"
          >
            {MESSES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.subtitle ? `(${m.subtitle})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider mb-1">
            Select Day of Week
          </label>
          <select
            value={selectedDay}
            onChange={(e) => {
              if (hasUnsavedChanges && !confirm("You have unsaved changes! Discard them and switch day?")) return;
              setSelectedDay(Number(e.target.value));
            }}
            className="w-full bg-[#FFF8F5] border-2 border-[#FFEDD5] rounded-xl px-3 py-2 text-xs font-bold text-[#221510] focus:outline-none focus:border-[#F97316]"
          >
            {DAYS_OF_WEEK.map((day, idx) => (
              <option key={day} value={idx}>
                {day}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save Button & Change Status Bar */}
      <div className="flex items-center justify-between my-4 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#C2410C]">
            Editing: <span className="underline">{DAYS_OF_WEEK[selectedDay]}</span>
          </span>

          {/* Status Badge */}
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

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50 ${
            hasUnsavedChanges
              ? "bg-gradient-to-r from-[#FF6B2C] to-[#EA580C] text-white shadow-[#F97316]/25 hover:opacity-95"
              : "bg-gray-100 text-gray-500 border border-gray-300 cursor-pointer hover:bg-gray-200"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Publishing..." : "Publish Menu Changes"}
        </button>
      </div>

      {/* Editor Main Content */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-bold text-[#C2410C]/60">
          Fetching dynamic menu from Firestore...
        </div>
      ) : (
        <div className="space-y-5 pb-12">
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="bg-white border-2 border-[#FFEDD5] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-[#FFEDD5] mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#C2410C] flex items-center gap-1.5">
                  <span>🍽️</span> {mealType}
                </h2>
                <button
                  type="button"
                  onClick={() => handleAddItem(mealType)}
                  className="text-[11px] font-bold text-[#F97316] bg-[#FFF8F5] border border-[#FFEDD5] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-[#FFF7ED]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Dish
                </button>
              </div>

              {menu[mealType].length === 0 ? (
                <p className="text-[11px] italic text-[#C2410C]/50 py-3 text-center">
                  No menu items configured for {mealType}. Click "+ Add Dish" above.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Columns Header Label Row */}
                  <div className="hidden sm:flex items-center justify-between px-3 text-[10px] font-bold text-[#C2410C]/70 uppercase tracking-wider border-b border-[#FFEDD5] pb-1">
                    <span className="flex-1">Dish Name / Menu Item</span>
                    <div className="flex items-center gap-2 pr-8">
                      <span className="w-16 text-center">Calories (kcal)</span>
                      <span className="w-14 text-center">Protein (g)</span>
                      <span className="w-14 text-center">Carbs (g)</span>
                    </div>
                  </div>

                  {menu[mealType].map((item, idx) => (
                    <div key={idx} className="bg-[#FFF8F5] border border-[#FFEDD5] p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      
                      {/* Dish Name */}
                      <div className="w-full sm:flex-1">
                        <label className="block sm:hidden text-[9px] font-bold text-[#C2410C] uppercase mb-0.5">Dish Name</label>
                        <input
                          type="text"
                          placeholder="Dish Name (e.g. Paneer Butter Masala)"
                          value={item.name}
                          onChange={(e) => handleItemChange(mealType, idx, "name", e.target.value)}
                          className="w-full bg-white border border-[#FFEDD5] px-3 py-1.5 rounded-lg text-xs font-bold text-[#221510] focus:outline-none focus:border-[#F97316]"
                        />
                      </div>

                      {/* Macros Inputs */}
                      <div className="flex items-center gap-2 text-[10px] text-[#C2410C] font-semibold flex-wrap w-full sm:w-auto">
                        <div>
                          <label className="block sm:hidden text-[9px] font-bold text-[#C2410C] uppercase mb-0.5">Calories</label>
                          <label className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-[#FFEDD5]">
                            🔥 <input type="number" value={item.calories || ""} onChange={(e) => handleItemChange(mealType, idx, "calories", Number(e.target.value))} className="w-12 text-center font-bold focus:outline-none" /> <span className="sm:hidden">kcal</span>
                          </label>
                        </div>

                        <div>
                          <label className="block sm:hidden text-[9px] font-bold text-[#C2410C] uppercase mb-0.5">Protein</label>
                          <label className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-[#FFEDD5]">
                            💪 <input type="number" value={item.protein || ""} onChange={(e) => handleItemChange(mealType, idx, "protein", Number(e.target.value))} className="w-10 text-center font-bold focus:outline-none" /> <span className="sm:hidden">g Pro</span>
                          </label>
                        </div>

                        <div>
                          <label className="block sm:hidden text-[9px] font-bold text-[#C2410C] uppercase mb-0.5">Carbs</label>
                          <label className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-[#FFEDD5]">
                            🌾 <input type="number" value={item.carbs || ""} onChange={(e) => handleItemChange(mealType, idx, "carbs", Number(e.target.value))} className="w-10 text-center font-bold focus:outline-none" /> <span className="sm:hidden">g Carb</span>
                          </label>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(mealType, idx)}
                        className="text-red-500 hover:text-red-700 p-1 self-end sm:self-center"
                        title="Remove Item"
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

    </div>
  );
}