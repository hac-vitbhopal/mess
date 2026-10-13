import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { type StudentProfile } from "@/lib/messhub";
import { Sparkles, CheckCircle, Download, Trash2, Utensils, Calendar } from "lucide-react";

/** Excel Formula Injection Guard */
function sanitizeExcelCell(val: any): string {
  if (val === null || val === undefined) return "N/A";
  const str = String(val).trim();
  if (/^[=+@\-\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// Default 2026 Navratri Menu mapping
const DEFAULT_NAVRATRI_MENUS: Record<string, { lunch: string[]; dinner: string[] }> = {
  "2026-10-11": { lunch: ["Sabudana Khichdi", "Curd", "Banana"], dinner: ["Morgan Khichdi", "Aloo Curry", "Sangam Kheer"] },
  "2026-10-12": { lunch: ["Samak Rice Pulao", "Cucumber Raita", "Doodhi Kheer"], dinner: ["Kuttu Chilla", "Aloo Kaddu curry", "Salad"] },
  "2026-10-13": { lunch: ["Singhara Puri", "Aloo Curry", "Fruit"], dinner: ["Sabudana khichdi", "Sweet curd", "Banana"] },
  "2026-10-14": { lunch: ["Morgan Khichdi", "Jeera Aloo", "Makhana Kheer"], dinner: ["Singhara Dosa", "Coconut Chutaney", "Papaya"] },
  "2026-10-15": { lunch: ["Kuttu Puri", "Aloo Peanut", "Curd"], dinner: ["Samak Rice Khichdi", "Salad", "Banana"] },
  "2026-10-16": { lunch: ["Samak Rice Pulao", "Kaddu Paneer Tomato", "Salad"], dinner: ["Sabudana Khichdi", "Curd", "Mix Fruits"] },
  "2026-10-17": { lunch: ["Singhara Roti", "Kaddu Veg", "Lassi"], dinner: ["Khichdi", "Aloo Tomato", "Papaya"] },
  "2026-10-18": { lunch: ["Sabudana Khichdi", "Curd", "Banana"], dinner: ["Singhara Dosa", "Coconut Chutaney", "Papaya"] },
  "2026-10-19": { lunch: ["Samak Rice Pulao", "Cucumber Raita", "Doodhi Kheer"], dinner: ["Kuttu Chilla", "Aloo Curry", "Banana"] }
};

/* ---------------- 🌟 1. SUPER ADMIN HUB COMPONENT ---------------- */
export function NavratriSpecialAdminHub({ allMesses }: { allMesses: any[] }) {
  const [isNavratriEnabled, setIsNavratriEnabled] = useState(false);
  const [isOptInEnabled, setIsOptInEnabled] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(() => "2026-10-11");
  const [lunchInput, setLunchInput] = useState("");
  const [dinnerInput, setDinnerInput] = useState("");
  const [dailyMenusMap, setDailyMenusMap] = useState<Record<string, { lunch: string[]; dinner: string[] }>>(DEFAULT_NAVRATRI_MENUS);

  const [optIns, setOptIns] = useState<any[]>([]);
  const [selectedMessFilter, setSelectedMessFilter] = useState<string>("all");
  
  const [manualEmails, setManualEmails] = useState("");
  const [manualMessId, setManualMessId] = useState(allMesses[0]?.id || "jmb");
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [successPopupMsg, setSuccessPopupMsg] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (!db) return;
    
    const unsubConfig = onSnapshot(doc(db, "platform_config", "navratri_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsNavratriEnabled(!!data.enabled);
        setIsOptInEnabled(!!data.optInEnabled);
        if (data.dailyMenusMap) {
          setDailyMenusMap(data.dailyMenusMap);
        }
      }
    });

    const unsubOptIns = onSnapshot(collection(db, "navratri_opt_ins"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOptIns(list);
    });

    return () => {
      unsubConfig();
      unsubOptIns();
    };
  }, []);

  useEffect(() => {
    const currentDayMenu = dailyMenusMap[selectedDate] || { lunch: [], dinner: [] };
    setLunchInput(currentDayMenu.lunch.join(", "));
    setDinnerInput(currentDayMenu.dinner.join(", "));
  }, [selectedDate, dailyMenusMap]);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setIsSavingConfig(true);
    try {
      const updatedMenusMap = {
        ...dailyMenusMap,
        [selectedDate]: {
          lunch: lunchInput.split(",").map(i => i.trim()).filter(Boolean),
          dinner: dinnerInput.split(",").map(i => i.trim()).filter(Boolean)
        }
      };

      await setDoc(doc(db, "platform_config", "navratri_settings"), {
        enabled: isNavratriEnabled,
        optInEnabled: isOptInEnabled,
        dailyMenusMap: updatedMenusMap,
        updatedByRole: "super-admin",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setDailyMenusMap(updatedMenusMap);
      setSuccessPopupMsg(`🌟 Navratri menu for ${selectedDate} published successfully!`);
      setTimeout(() => setSuccessPopupMsg(null), 4000);
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleAddManualStudents(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !manualEmails.trim()) return;

    setIsAddingManual(true);
    try {
      const rawList = manualEmails.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
      let addedCount = 0;

      for (const email of rawList) {
        if (email.endsWith("@vitbhopal.ac.in")) {
          const namePart = email.split("@")[0].replace(/[._0-9]/g, " ");
          const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1).trim() || "Campus Student";

          await addDoc(collection(db, "navratri_opt_ins"), {
            name: sanitizeExcelCell(formattedName),
            email: sanitizeExcelCell(email),
            messId: sanitizeExcelCell(manualMessId),
            source: "admin_manual_add",
            createdAt: serverTimestamp(),
          });
          addedCount++;
        }
      }

      setManualEmails("");
      setSuccessPopupMsg(`🎉 Successfully registered ${addedCount} student(s) for ${manualMessId.toUpperCase()}!`);
      setTimeout(() => setSuccessPopupMsg(null), 4000);
    } catch (err) {
      console.error("Manual add error:", err);
      alert("Failed to add student records.");
    } finally {
      setIsAddingManual(false);
    }
  }

  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        for (const row of json) {
          const name = row["Name"] || row["name"] || row["Student Name"];
          const email = (row["Email"] || row["email"] || "").trim().toLowerCase();
          const mess = (row["Mess"] || row["mess"] || row["Assigned Mess"] || "jmb").trim().toLowerCase();

          if (email && email.endsWith("@vitbhopal.ac.in")) {
            await addDoc(collection(db!, "navratri_opt_ins"), {
              name: sanitizeExcelCell(name || "Campus Student"),
              email: sanitizeExcelCell(email),
              messId: sanitizeExcelCell(mess),
              source: "admin_excel_upload",
              createdAt: serverTimestamp(),
            });
            importedCount++;
          }
        }

        setSuccessPopupMsg(`✅ Successfully bulk imported ${importedCount} student records!`);
        setTimeout(() => setSuccessPopupMsg(null), 4000);
      } catch (err) {
        console.error("Excel import error:", err);
        alert("Failed to parse Excel file.");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const filteredOptIns = useMemo(() => {
    if (selectedMessFilter === "all") return optIns;
    return optIns.filter(o => o.messId === selectedMessFilter);
  }, [optIns, selectedMessFilter]);

  function exportOptInsToExcel() {
    if (filteredOptIns.length === 0) {
      alert("No records available to export.");
      return;
    }
    const rows = filteredOptIns.map(o => ({
      "Student Name": sanitizeExcelCell(o.name),
      "Email": sanitizeExcelCell(o.email),
      "Assigned Mess": sanitizeExcelCell(o.messId?.toUpperCase()),
      "Registration Source": o.source === "admin_excel_upload" ? "Bulk Upload" : o.source === "admin_manual_add" ? "Manual Admin Add" : "Student Self Opt-In",
      "Registered At": o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Recent"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NavratriOptIns");
    XLSX.writeFile(wb, `Navratri_OptIns_${selectedMessFilter.toUpperCase()}_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 relative">
      {successPopupMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-elevated flex items-center gap-3 border border-emerald-500">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{successPopupMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-border p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Festival Management Module
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Navratri Special Edition Hub (2026)</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Publish date-wise menus and manage mess-specific student registrations.</p>
        </div>

        <button
          onClick={exportOptInsToExcel}
          className="gradient-warm text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" /> Export Registered List
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveConfig} className="bg-white rounded-3xl border border-border p-6 shadow-card space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-border space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>🎛️</span> Feature Access Controls
              </h2>
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between cursor-pointer bg-[#fbf7f2] p-3 rounded-2xl border border-border">
                  <span className="text-xs font-bold text-foreground">Enable Special Menu for Registered Students</span>
                  <input
                    type="checkbox"
                    checked={isNavratriEnabled}
                    onChange={(e) => setIsNavratriEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer bg-[#fbf7f2] p-3 rounded-2xl border border-border">
                  <span className="text-xs font-bold text-foreground">Show Bottom Opt-In Form</span>
                  <input
                    type="checkbox"
                    checked={isOptInEnabled}
                    onChange={(e) => setIsOptInEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Select Festival Date:</label>
              <input
                type="date"
                value={selectedDate}
                min="2026-10-11"
                max="2026-10-19"
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">🍽️ Lunch Menu ({selectedDate}):</label>
                <textarea
                  rows={2}
                  value={lunchInput}
                  onChange={(e) => setLunchInput(e.target.value)}
                  placeholder="Sabudana Khichdi, Curd, Banana"
                  className="w-full resize-none rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">🌙 Dinner Menu ({selectedDate}):</label>
                <textarea
                  rows={2}
                  value={dinnerInput}
                  onChange={(e) => setDinnerInput(e.target.value)}
                  placeholder="Morgan Khichdi, Aloo Curry, Sangam Kheer"
                  className="w-full resize-none rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full gradient-warm text-white py-3 rounded-2xl text-xs font-bold shadow-xs cursor-pointer"
            >
              {isSavingConfig ? "Publishing..." : `Publish Menu for ${selectedDate}`}
            </button>
          </div>
        </form>

        <form onSubmit={handleAddManualStudents} className="bg-white rounded-3xl border border-border p-6 shadow-card space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>✍️</span> Register Student Email(s) by Mess
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Students will only see the special menu if registered for their assigned mess.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Mess Facility:</label>
              <select
                value={manualMessId}
                onChange={(e) => setManualMessId(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-bold outline-none cursor-pointer uppercase"
              >
                {allMesses.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Student Email(s):</label>
              <textarea
                required
                rows={4}
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="student1@vitbhopal.ac.in, student2@vitbhopal.ac.in"
                className="w-full resize-none rounded-xl border border-border bg-[#fbf7f2] px-3.5 py-2.5 text-xs font-medium outline-none"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isAddingManual || !manualEmails.trim()}
              className="w-full bg-black text-white py-3 rounded-2xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {isAddingManual ? "Registering..." : "Register Student(s) for Mess"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-border p-6 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>📋</span> Registered Students Directory ({filteredOptIns.length})
            </h2>
            <select
              value={selectedMessFilter}
              onChange={(e) => setSelectedMessFilter(e.target.value)}
              className="rounded-xl border border-border bg-[#fbf7f2] px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="all">All Messes</option>
              {allMesses.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          {filteredOptIns.length === 0 ? (
            <p className="py-12 text-center text-xs italic text-muted-foreground">No students registered for Navratri special meals yet.</p>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-50 sticky top-0">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Mess</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredOptIns.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#fbf7f2]">
                    <td className="py-3.5 px-4 font-bold text-foreground">{item.name}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{item.email}</td>
                    <td className="py-3.5 px-4 font-bold uppercase text-[10px] text-orange-600">{item.messId}</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.source === "admin_excel_upload" ? "bg-purple-100 text-purple-700" : item.source === "admin_manual_add" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.source === "admin_excel_upload" ? "Excel Upload" : item.source === "admin_manual_add" ? "Manual Admin" : "Self Opt-In"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={async () => {
                          if (confirm(`Remove ${item.name} from Navratri registration?`)) {
                            await deleteDoc(doc(db!, "navratri_opt_ins", item.id));
                          }
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Remove record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 🌟 2. STUDENT PORTAL NAVRATRI COMPONENT (COST-OPTIMIZED) ---------------- */
export function NavratriStudentWidget({ profile }: { profile: StudentProfile }) {
  const [config, setConfig] = useState<any>(null);
  
  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Cache Key unique to student email and today's date
  const cacheKey = useMemo(() => {
    return profile?.email ? `navratri_status_${profile.email.toLowerCase()}_${todayDateStr}` : null;
  }, [profile?.email, todayDateStr]);

  // Initialize state from localStorage if available (0 Firebase reads!)
  const [isRegisteredForCorrectMess, setIsRegisteredForCorrectMess] = useState<boolean>(() => {
    if (typeof window === "undefined" || !cacheKey) return false;
    const cached = localStorage.getItem(cacheKey);
    return cached !== null ? JSON.parse(cached) : false;
  });

  const [hasOptedIn, setHasOptedIn] = useState<boolean>(() => {
    if (typeof window === "undefined" || !cacheKey) return false;
    const cached = localStorage.getItem(cacheKey);
    return cached !== null ? JSON.parse(cached) : false;
  });

  const [isOptingIn, setIsOptingIn] = useState(false);

  useEffect(() => {
    if (!db || !profile?.email || !profile?.messId) return;

    // 1. Listen only to global platform config (cached globally by browser/Next.js)
    const unsubConfig = onSnapshot(doc(db, "platform_config", "navratri_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.enabled || data.optInEnabled) {
          setConfig(data);
        } else {
          setConfig(null);
        }
      }
    });

    // 2. If already cached in localStorage for today, skip Firestore query entirely!
    if (cacheKey && localStorage.getItem(cacheKey) !== null) {
      return () => { unsubConfig(); };
    }

    // 3. Fallback: Query Firestore ONCE if not cached yet today
    const q = query(
      collection(db, "navratri_opt_ins"),
      where("email", "==", profile.email.toLowerCase())
    );

    const unsubOptInCheck = onSnapshot(q, (snapshot) => {
      const match = snapshot.docs.find(d => {
        const data = d.data();
        return data.messId?.toLowerCase() === profile.messId?.toLowerCase();
      });

      const isRegistered = !!match;
      setIsRegisteredForCorrectMess(isRegistered);
      setHasOptedIn(isRegistered);

      // Save to localStorage so future reloads today cost 0 reads
      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify(isRegistered));
      }
    });

    return () => {
      unsubConfig();
      unsubOptInCheck();
    };
  }, [profile?.email, profile?.messId, cacheKey]);

  async function handleOptIn() {
    if (!db || !profile?.email) return;
    setIsOptingIn(true);
    try {
      await addDoc(collection(db, "navratri_opt_ins"), {
        name: profile.name || "VIT Student",
        email: profile.email.toLowerCase(),
        messId: profile.messId || "jmb",
        source: "student_self_opt_in",
        createdAt: serverTimestamp(),
      });
      
      setHasOptedIn(true);
      setIsRegisteredForCorrectMess(true);

      // Immediately update local cache
      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify(true));
      }

      alert("🌟 Successfully registered for Navratri Special meals!");
    } catch (err) {
      console.error("Opt-in error:", err);
      alert("Failed to register. Please try again.");
    } finally {
      setIsOptingIn(false);
    }
  }

  if (!config) return null;
  if (config.enabled && !isRegisteredForCorrectMess) return null;

  const todayMenu = config.dailyMenusMap?.[todayDateStr] || { lunch: [], dinner: [] };
  const hasLunch = todayMenu.lunch && todayMenu.lunch.length > 0;
  const hasDinner = todayMenu.dinner && todayMenu.dinner.length > 0;

  return (
    <div className="space-y-4">
      {config.enabled && isRegisteredForCorrectMess && (hasLunch || hasDinner) && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <span>✨</span> Navratri Special Menu Edition ({todayDateStr})
            </div>
            <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-md uppercase">
              Registered Fasting Plate ({profile.messId.toUpperCase()})
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasLunch && (
              <div className="bg-[#fbf7f2] border border-border/70 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <span>🍽️</span>
                  <span>Lunch Fasting</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t border-border/60 pt-2">
                  {todayMenu.lunch.map((item: string, idx: number) => (
                    <li key={idx} className="font-medium flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasDinner && (
              <div className="bg-[#fbf7f2] border border-border/70 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <span>🌙</span>
                  <span>Dinner Fasting</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t border-border/60 pt-2">
                  {todayMenu.dinner.map((item: string, idx: number) => (
                    <li key={idx} className="font-medium flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {config.optInEnabled && !isRegisteredForCorrectMess && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between gap-3 text-foreground">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Navratri Special Menu Registration</h4>
              <p className="text-[11px] text-muted-foreground">Register to receive fasting plates during the festival.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOptIn}
            disabled={isOptingIn}
            className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isOptingIn ? "Registering..." : "Register"}
          </button>
        </div>
      )}

      {config.optInEnabled && isRegisteredForCorrectMess && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between gap-3 text-foreground">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-800">Navratri Special Meal Registration Confirmed ({profile.messId.toUpperCase()})</span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-200/60 text-emerald-900 px-2.5 py-1 rounded-lg">
            Active
          </span>
        </div>
      )}
    </div>
  );
}