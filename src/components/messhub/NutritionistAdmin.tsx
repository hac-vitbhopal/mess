import { useState, useEffect } from "react";
import { MESSES, saveDynamicMessMenu, getDynamicMessMenu, type MessId, type DayMenuWithNutrition, type MenuItemWithNutrition } from "@/lib/messhub";
import { Plus, Trash2, Save, Flame } from "lucide-react";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"] as const;

export function NutritionistAdmin() {
  const [selectedMess, setSelectedMess] = useState<MessId>("jmb");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [menu, setMenu] = useState<DayMenuWithNutrition>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });

  // Load menu when mess or day changes
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await getDynamicMessMenu(selectedMess, selectedDay);
      if (data) {
        setMenu(data);
      } else {
        // Default empty structure
        setMenu({ breakfast: [], lunch: [], snacks: [], dinner: [] });
      }
      setIsLoading(false);
    }
    load();
  }, [selectedMess, selectedDay]);

  const handleAddItem = (meal: keyof DayMenuWithNutrition) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: [...prev[meal], { name: "", calories: 150, protein: 5, carbs: 20, fat: 4 }],
    }));
  };

  const handleRemoveItem = (meal: keyof DayMenuWithNutrition, index: number) => {
    setMenu((prev) => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== index),
    }));
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
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveDynamicMessMenu(selectedMess, selectedDay, menu);
      alert("Menu and Nutrition data updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save menu changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border-2 border-[#FFEDD5] shadow-sm max-w-4xl mx-auto my-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#FFEDD5]">
        <div>
          <h2 className="text-xl font-black text-[#221510] flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F97316]" /> Nutritionist & Menu Editor
          </h2>
          <p className="text-xs text-[#C2410C]/80 mt-0.5">Manage meal items and macro nutrition details for VIT Bhopal messes.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-[#FF6B2C] to-[#EA580C] text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-[#F97316]/20 hover:opacity-95 active:scale-95 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Publish Menu"}
        </button>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
        <div>
          <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider mb-1">Select Mess</label>
          <select
            value={selectedMess}
            onChange={(e) => setSelectedMess(e.target.value as MessId)}
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
          <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider mb-1">Select Day</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
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

      {/* Meal Editor Section */}
      {isLoading ? (
        <p className="py-10 text-center text-xs font-semibold text-[#C2410C]/60">Loading menu data...</p>
      ) : (
        <div className="space-y-6 mt-6">
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="border border-[#FFEDD5] rounded-2xl p-4 bg-[#FFF8F5]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase text-[#C2410C] tracking-wider">{mealType}</h3>
                <button
                  type="button"
                  onClick={() => handleAddItem(mealType)}
                  className="text-xs font-bold text-[#F97316] bg-white border border-[#FFEDD5] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-[#FFF7ED]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {menu[mealType].length === 0 ? (
                <p className="text-[11px] italic text-[#C2410C]/50 py-2">No menu items added for {mealType} yet.</p>
              ) : (
                <div className="space-y-3">
                  {menu[mealType].map((item, idx) => (
                    <div key={idx} className="bg-white border border-[#FFEDD5] p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <input
                        type="text"
                        placeholder="Item name (e.g. Paneer Butter Masala)"
                        value={item.name}
                        onChange={(e) => handleItemChange(mealType, idx, "name", e.target.value)}
                        className="flex-1 bg-transparent text-xs font-bold text-[#221510] border-b border-[#FFEDD5] pb-1 focus:outline-none focus:border-[#F97316]"
                      />

                      {/* Macros Input Fields */}
                      <div className="flex items-center gap-2 text-[10px] text-[#C2410C] font-semibold w-full sm:w-auto">
                        <label className="flex items-center gap-1">
                          🔥 <input type="number" value={item.calories || ""} onChange={(e) => handleItemChange(mealType, idx, "calories", Number(e.target.value))} className="w-12 bg-[#FFF8F5] border rounded px-1 text-center text-xs" /> kcal
                        </label>
                        <label className="flex items-center gap-1">
                          💪 <input type="number" value={item.protein || ""} onChange={(e) => handleItemChange(mealType, idx, "protein", Number(e.target.value))} className="w-10 bg-[#FFF8F5] border rounded px-1 text-center text-xs" /> g P
                        </label>
                        <label className="flex items-center gap-1">
                          🌾 <input type="number" value={item.carbs || ""} onChange={(e) => handleItemChange(mealType, idx, "carbs", Number(e.target.value))} className="w-10 bg-[#FFF8F5] border rounded px-1 text-center text-xs" /> g C
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(mealType, idx)}
                        className="text-red-500 hover:text-red-700 p-1 self-end sm:self-center"
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