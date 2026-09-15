import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAdminSession, MEAL_DEFS, type MealKey, type DayMenuWithNutrition } from "@/lib/messhub";
import { Building2, Save, ArrowLeft, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/add-mess")({
  head: () => ({
    meta: [
      { title: "Register New Mess & 7-Day Timetable — Super Admin" },
      { name: "description", content: "Master mess provisioning and weekly timetable setup." },
    ],
  }),
  component: AddMessPage,
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

type WeeklyGrid = {
  [dayIndex: number]: {
    [K in MealKey]: string;
  };
};

const initialTimetable: WeeklyGrid = {
  0: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  1: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  2: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  3: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  4: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  5: { breakfast: "", lunch: "", snacks: "", dinner: "" },
  6: { breakfast: "", lunch: "", snacks: "", dinner: "" },
};

function AddMessPage() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [messId, setMessId] = useState("");
  const [messName, setMessName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [timetable, setTimetable] = useState<WeeklyGrid>(initialTimetable);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔒 STRICT SUPER-ADMIN ACCESS GUARD
  useEffect(() => {
    const session = getAdminSession();
    if (!session || session.role !== "super-admin") {
      setIsAuthorized(false);
      navigate({ to: "/super-admin" });
    } else {
      setIsAuthorized(true);
    }
  }, [navigate]);

  if (isAuthorized === null) {
    return <div className="min-h-screen bg-[#fbf7f2]" />;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#1c1c1e] text-white flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold">Access Restricted</h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          This portal requires active Master Super-Admin authorization.
        </p>
        <Link to="/super-admin" className="mt-4 text-xs font-bold underline text-primary">
          Authenticate Root Session
        </Link>
      </div>
    );
  }

  const handleCellChange = (dayIndex: number, meal: MealKey, value: string) => {
    setTimetable((prev) => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        [meal]: value,
      },
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanId = messId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const cleanName = messName.trim();

    if (!cleanId || !cleanName || !db) {
      alert("Please provide a valid Unique Mess ID and Mess Facility Name.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Dining Facility in 'messes' collection
      await setDoc(doc(db, "messes", cleanId), {
        id: cleanId,
        name: cleanName,
        subtitle: subtitle.trim(),
        createdAt: serverTimestamp(),
      });

      // 2. Commit all 7 days of Timetable into 'mess_menus'
      for (const day of WEEKDAYS) {
        const dayMenu: DayMenuWithNutrition = {
          breakfast: timetable[day.i].breakfast.split("\n").map(s => s.trim()).filter(Boolean).map(name => ({ name, calories: 200, protein: 6, carbs: 25, fat: 5 })),
          lunch: timetable[day.i].lunch.split("\n").map(s => s.trim()).filter(Boolean).map(name => ({ name, calories: 350, protein: 12, carbs: 45, fat: 8 })),
          snacks: timetable[day.i].snacks.split("\n").map(s => s.trim()).filter(Boolean).map(name => ({ name, calories: 180, protein: 4, carbs: 22, fat: 6 })),
          dinner: timetable[day.i].dinner.split("\n").map(s => s.trim()).filter(Boolean).map(name => ({ name, calories: 400, protein: 15, carbs: 50, fat: 10 })),
        };

        await setDoc(doc(db, "mess_menus", `${cleanId}_${day.i}`), {
          ...dayMenu,
          messId: cleanId,
          day: day.i,
          updatedAt: serverTimestamp(),
          updatedByRole: "super-admin",
        });
      }

      // 3. Write Immutable Audit Log
      await addDoc(collection(db, "admin_audit_logs"), {
        messId: cleanId,
        action: "Mess Registered",
        details: `Provisioned facility "${cleanName}" (${cleanId}) with 7-day timetable matrix`,
        operatorRole: "super-admin",
        timestamp: serverTimestamp(),
      });

      alert(`✅ Successfully created ${cleanName} and saved the 7-day weekly timetable!`);
      navigate({ to: "/super-admin" });
    } catch (err) {
      console.error(err);
      alert("Error provisioning mess. Please check network and permissions.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf7f2] font-sans pb-24 text-slate-900">
      {/* Top Header */}
      <header className="safe-top bg-white border-b border-border sticky top-0 z-40 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/super-admin"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Back to HQ
            </Link>
            <div>
              <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Register New Mess & Weekly Timetable
              </h1>
              <p className="text-xs text-muted-foreground">
                Provision a dining node and configure its full 7-day schedule grid.
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !messId.trim() || !messName.trim()}
            className="gradient-warm text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-card active:scale-95 transition disabled:opacity-40 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Provisioning..." : "Save & Publish Mess"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Facility Identity Information */}
        <section className="bg-white rounded-3xl p-6 border border-border shadow-card space-y-4">
          <div className="pb-3 border-b border-border">
            <h2 className="text-base font-black text-foreground">Facility Information</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Specify identifying parameters for this dining hall.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-muted-foreground mb-1">
                Unique Mess ID <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={messId}
                onChange={(e) => setMessId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="e.g. boys_block_2"
                className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Lowercase identifier used internally.</span>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-muted-foreground mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                value={messName}
                onChange={(e) => setMessName(e.target.value)}
                placeholder="e.g. Boys Block 2 Mess"
                className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Name visible to students and admins.</span>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-muted-foreground mb-1">
                Subtitle / Wing (Optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Ground Floor"
                className="w-full bg-[#fbf7f2] border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">Secondary location label.</span>
            </div>
          </div>
        </section>

        {/* Section 2: Full 7-Day Weekly Timetable Grid */}
        <section className="bg-white rounded-3xl p-6 border border-border shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <span>🗓️</span> 7-Day Master Weekly Timetable Table
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type menu items directly into each table cell. Put each dish on a new line.
              </p>
            </div>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-300 w-fit">
              One item per line in each cell
            </span>
          </div>

          {/* Responsive Timetable Matrix Table */}
          <div className="overflow-x-auto border border-border/80 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead className="bg-[#fbf7f2] text-foreground">
                <tr className="border-b border-border">
                  <th className="p-3.5 font-black uppercase text-[11px] tracking-wider w-36 border-r border-border bg-zinc-100/70">
                    Day / Meal
                  </th>
                  {MEAL_DEFS.map((meal) => (
                    <th key={meal.key} className="p-3.5 font-bold uppercase text-[11px] tracking-wider border-r last:border-r-0 border-border">
                      <div className="flex items-center gap-1.5">
                        <span>{meal.icon}</span>
                        <span>{meal.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {WEEKDAYS.map((day) => (
                  <tr key={day.i} className="hover:bg-slate-50/50 transition">
                    <td className="p-3.5 font-black text-slate-800 bg-zinc-50/50 border-r border-border align-top">
                      <div className="sticky top-0">
                        <span>{day.name}</span>
                      </div>
                    </td>

                    {MEAL_TYPES.map((mealKey) => (
                      <td key={mealKey} className="p-2 border-r last:border-r-0 border-border align-top">
                        <textarea
                          rows={4}
                          value={timetable[day.i][mealKey]}
                          onChange={(e) => handleCellChange(day.i, mealKey, e.target.value)}
                          placeholder={`Dishes for ${day.name} ${mealKey}...`}
                          className="w-full bg-white border border-border/70 rounded-xl p-2.5 text-xs font-semibold text-foreground resize-y outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}