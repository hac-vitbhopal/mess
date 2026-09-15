import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { X, Plus, Save } from "lucide-react";
import { type MessId, type DayMenuWithNutrition } from "@/lib/messhub";

export function AddMessAndMenuModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messId, setMessId] = useState("");
  const [messName, setMessName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday default
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "snacks" | "dinner">("lunch");
  
  const [dishName, setDishName] = useState("");
  const [calories, setCalories] = useState(250);
  const [protein, setProtein] = useState(10);
  const [carbs, setCarbs] = useState(30);

  // Temporary local state for building the day's menu before saving
  const [currentDayMenu, setCurrentDayMenu] = useState<DayMenuWithNutrition>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddDish = () => {
    if (!dishName.trim()) return;
    setCurrentDayMenu((prev) => ({
      ...prev,
      [mealType]: [
        ...prev[mealType],
        { name: dishName.trim(), calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: 5 }
      ]
    }));
    setDishName("");
  };

  const handleSaveToFirestore = async () => {
    if (!messId.trim() || !messName.trim()) {
      alert("Please provide a Mess ID and Name.");
      return;
    }

    setIsSaving(true);
    try {
      // Save menu item document to Firestore using standard messhub convention
      const docId = `${messId.toLowerCase().trim()}_day_${selectedDay}`;
      if (db) {
        // ⚡ FIX: Added { merge: true } to prevent wiping out other meals in the day's menu document
        await setDoc(doc(db, "mess_menus", docId), {
          ...currentDayMenu,
          messId: messId.toLowerCase().trim(),
          dayIndex: selectedDay,
          updatedAt: serverTimestamp(),
          updatedByRole: "super-admin"
        }, { merge: true });
      }

      alert(`✅ Successfully created/updated menu for ${messName} (${selectedDay === 1 ? "Monday" : "Day " + selectedDay})!`);
      onClose();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save new mess facility configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-elevated space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-lg font-black text-foreground">🏢 Provision New Mess &amp; Menu</h2>
            <p className="text-xs text-muted-foreground">Add a new dining facility and configure its meal schedule.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mess Meta Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Mess ID (e.g. 'nilgiri')</label>
            <input
              type="text"
              value={messId}
              onChange={(e) => setMessId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="nilgiri_mess"
              className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Display Name</label>
            <input
              type="text"
              value={messName}
              onChange={(e) => setMessName(e.target.value)}
              placeholder="Nilgiri Dining Hall"
              className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Subtitle (Optional)</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Boys / Block 3"
              className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Admin Passcode Key</label>
            <input
              type="text"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="secret_key_123"
              className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Day & Meal Selector */}
        <div className="bg-[#fbf7f2] p-4 rounded-2xl border border-border/60 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configure Menu Items &amp; Macros</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1">Weekday</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1">Meal Window</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as any)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none capitalize"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snacks">Snacks</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>

          {/* Add Dish Row */}
          <div className="space-y-2 pt-2">
            <input
              type="text"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="Dish Name (e.g. Shahi Paneer)"
              className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input type="number" value={calories} onChange={(e) => setCalories(Number(e.target.value))} placeholder="kcal" className="w-1/3 bg-white border border-border rounded-xl px-3 py-1.5 text-xs" />
              <input type="number" value={protein} onChange={(e) => setProtein(Number(e.target.value))} placeholder="Protein (g)" className="w-1/3 bg-white border border-border rounded-xl px-3 py-1.5 text-xs" />
              <input type="number" value={carbs} onChange={(e) => setCarbs(Number(e.target.value))} placeholder="Carbs (g)" className="w-1/3 bg-white border border-border rounded-xl px-3 py-1.5 text-xs" />
              <button onClick={handleAddDish} type="button" className="gradient-warm text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {/* Preview Added Items for this Meal */}
          <div className="pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Added to {mealType}:</p>
            <div className="flex flex-wrap gap-1.5">
              {currentDayMenu[mealType].length === 0 ? (
                <span className="text-[11px] italic text-muted-foreground">No dishes added yet for this meal.</span>
              ) : (
                currentDayMenu[mealType].map((item, idx) => (
                  <span key={idx} className="bg-white border border-border px-2.5 py-1 rounded-lg text-[10px] font-bold text-foreground">
                    {item.name} ({item.calories} kcal)
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-bold cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSaveToFirestore}
            disabled={isSaving}
            className="gradient-warm text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-card cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Provisioning..." : "Save Mess & Publish Menu"}
          </button>
        </div>

      </div>
    </div>
  );
}