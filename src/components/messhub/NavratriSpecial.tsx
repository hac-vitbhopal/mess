import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { type StudentProfile } from "@/lib/messhub";
import { Sparkles, CheckCircle, Download, Trash2, Utensils, Calendar, Save, Plus } from "lucide-react";

/** Excel Formula Injection Guard */
function sanitizeExcelCell(val: any): string {
  if (val === null || val === undefined) return "N/A";
  const str = String(val).trim();
  if (/^[=+@\-\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/* ---------------- 🌟 1. SUPER ADMIN HUB COMPONENT (FAST DAY SPECIAL) ---------------- */
export function NavratriSpecialAdminHub({ allMesses }: { allMesses: any[] }) {
  const [isFastDayEnabled, setIsFastDayEnabled] = useState(false);
  const [isOptInEnabled, setIsOptInEnabled] = useState(false);
  
  const [targetMessId, setTargetMessId] = useState<string>("all");
  const [eventLabel, setEventLabel] = useState("Ekadashi & Fast Special Spread");

  // Dynamic Schedule Rows State
  const [scheduleRows, setScheduleRows] = useState<Array<{ date: string; meal: "lunch" | "dinner"; items: string }>>([
    { date: new Date().toISOString().split("T")[0], meal: "lunch", items: "Sabudana Khichdi, Curd, Banana" },
    { date: new Date().toISOString().split("T")[0], meal: "dinner", items: "Morgan Khichdi, Aloo Curry, Sangam Kheer" }
  ]);

  const [optIns, setOptIns] = useState<any[]>([]);
  const [selectedMessFilter, setSelectedMessFilter] = useState<string>("all");
  
  const [manualEmails, setManualEmails] = useState("");
  const [manualMessId, setManualMessId] = useState(allMesses[0]?.id || "jmb");
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [successPopupMsg, setSuccessPopupMsg] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (!db) return;
    
    const unsubConfig = onSnapshot(doc(db, "platform_config", "fast_day_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsFastDayEnabled(!!data.enabled);
        setIsOptInEnabled(!!data.optInEnabled);
        if (data.eventLabel) setEventLabel(data.eventLabel);
        if (data.scheduleRows) setScheduleRows(data.scheduleRows);
      }
    });

    const unsubOptIns = onSnapshot(collection(db, "fast_day_opt_ins"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOptIns(list);
    });

    return () => {
      unsubConfig();
      unsubOptIns();
    };
  }, []);

  const handleAddRow = () => {
    setScheduleRows([...scheduleRows, { date: new Date().toISOString().split("T")[0], meal: "lunch", items: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    setScheduleRows(scheduleRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    const updated = [...scheduleRows];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleRows(updated);
  };

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    const firestoreDb = db;
    if (!firestoreDb) return;

    setIsSavingConfig(true);
    try {
      const targetMessList = targetMessId === "all" ? allMesses.map(m => m.id) : [targetMessId];
      const batch = writeBatch(firestoreDb);

      const dailyMenusMap: Record<string, { lunch: string[]; dinner: string[] }> = {};
      scheduleRows.forEach(row => {
        if (!row.date) return;
        if (!dailyMenusMap[row.date]) {
          dailyMenusMap[row.date] = { lunch: [], dinner: [] };
        }
        const parsedItems = row.items.split(",").map(i => i.trim()).filter(Boolean);
        if (row.meal === "lunch") {
          dailyMenusMap[row.date].lunch = parsedItems;
        } else {
          dailyMenusMap[row.date].dinner = parsedItems;
        }
      });

      batch.set(doc(firestoreDb, "platform_config", "fast_day_settings"), {
        enabled: isFastDayEnabled,
        optInEnabled: isOptInEnabled,
        eventLabel,
        scheduleRows,
        dailyMenusMap,
        updatedByRole: "super-admin",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      targetMessList.forEach((messId) => {
        scheduleRows.forEach(row => {
          if (!row.date) return;
          const parsedItems = row.items.split(",").map(i => i.trim()).filter(Boolean);

          const dailyRef = doc(firestoreDb, "daily_menus", `${messId}_${row.date}`);
          batch.set(dailyRef, {
            messId,
            date: row.date,
            [row.meal]: parsedItems,
            updatedAt: serverTimestamp(),
            updatedByRole: "super-admin"
          }, { merge: true });

          const overrideRef = doc(collection(firestoreDb, "mess_overrides"), `${messId}_${row.date}`);
          batch.set(overrideRef, {
            messId,
            date: row.date,
            label: eventLabel,
            menu: { 
              breakfast: [], 
              lunch: row.meal === "lunch" ? parsedItems : [], 
              snacks: [], 
              dinner: row.meal === "dinner" ? parsedItems : [] 
            },
            startTime: "07:30",
            endTime: "23:59",
            expiresAt: new Date(`${row.date}T23:59:00`).toISOString(),
          }, { merge: true });
        });

        batch.set(doc(firestoreDb, "mess_meta", messId), {
          version: Date.now(),
          lastPublishedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();

      setSuccessPopupMsg(`🌟 "${eventLabel}" successfully published to ${targetMessId === "all" ? "all messes" : targetMessId.toUpperCase()}!`);
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

          await addDoc(collection(db, "fast_day_opt_ins"), {
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
      "Registration Source": o.source === "admin_manual_add" ? "Manual Admin Add" : "Student Self Opt-In",
      "Registered At": o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Recent"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FastDayOptIns");
    XLSX.writeFile(wb, `FastDay_OptIns_${selectedMessFilter.toUpperCase()}_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 relative text-[#193A40]">
      {successPopupMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border border-emerald-500">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{successPopupMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#007F86]/10 text-[#007F86] px-3 py-1 rounded-full text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Fast Day Management Module
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#193A40]">Fast Day Special Hub</h1>
          <p className="text-xs sm:text-sm text-[#193A40]/70 mt-0.5">Publish custom fast day menus and manage mess-specific student registrations.</p>
        </div>

        <button
          onClick={exportOptInsToExcel}
          className="bg-[#007F86] text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto hover:opacity-90"
        >
          <Download className="w-4 h-4" /> Export Registered List
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveConfig} className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#B5DED4] space-y-3">
              <h2 className="text-sm font-bold text-[#193A40] flex items-center gap-2">
                <span>🎛️</span> Feature Access Controls &amp; Event Title
              </h2>

              {/* 🌟 Event Name Editable Field at Top */}
              <div>
                <label className="block text-xs font-bold text-[#193A40] mb-1">Event / Fast Title:</label>
                <input
                  type="text"
                  required
                  value={eventLabel}
                  onChange={(e) => setEventLabel(e.target.value)}
                  placeholder="e.g. Ekadashi Fast Special Menu"
                  className="w-full rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/40 px-3 py-2.5 text-xs font-bold outline-none focus:border-[#007F86] text-[#193A40]"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center justify-between cursor-pointer bg-[#E9F7F4]/40 p-3 rounded-2xl border border-[#B5DED4]">
                  <span className="text-xs font-bold text-[#193A40]">Enable Fast Day Special Menu</span>
                  <input
                    type="checkbox"
                    checked={isFastDayEnabled}
                    onChange={(e) => setIsFastDayEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#B5DED4] text-[#007F86] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer bg-[#E9F7F4]/40 p-3 rounded-2xl border border-[#B5DED4]">
                  <span className="text-xs font-bold text-[#193A40]">Show Student Opt-In Form</span>
                  <input
                    type="checkbox"
                    checked={isOptInEnabled}
                    onChange={(e) => setIsOptInEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#B5DED4] text-[#007F86] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#193A40] mb-1">Target Mess Facility / Scope:</label>
              <select
                value={targetMessId}
                onChange={(e) => setTargetMessId(e.target.value)}
                className="w-full rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/40 px-3 py-2.5 text-xs font-bold outline-none focus:border-[#007F86] text-[#193A40] cursor-pointer"
              >
                <option value="all">🌍 All Messes (Global Fast Day Spread)</option>
                {allMesses.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} {m.subtitle ? `(${m.subtitle})` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full bg-[#007F86] text-white py-3 rounded-2xl text-xs font-bold shadow-xs cursor-pointer hover:opacity-90 disabled:opacity-40"
            >
              {isSavingConfig ? "Publishing Spread..." : "Publish Fast Day Spread to Target"}
            </button>
          </div>
        </form>

        <form onSubmit={handleAddManualStudents} className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#B5DED4]">
              <h2 className="text-sm font-bold text-[#193A40] flex items-center gap-2">
                <span>✍️</span> Register Student Email(s) by Mess
              </h2>
              <p className="text-[11px] text-[#193A40]/70 mt-0.5">Students will only see the special fast menu if registered for their assigned mess.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#193A40] mb-1">Target Mess Facility:</label>
              <select
                value={manualMessId}
                onChange={(e) => setManualMessId(e.target.value)}
                className="w-full rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/40 px-3 py-2.5 text-xs font-bold outline-none cursor-pointer uppercase text-[#193A40]"
              >
                {allMesses.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#193A40] mb-1">Student Email(s):</label>
              <textarea
                required
                rows={4}
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="student1@vitbhopal.ac.in, student2@vitbhopal.ac.in"
                className="w-full resize-none rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/40 px-3.5 py-2.5 text-xs font-medium outline-none text-[#193A40]"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isAddingManual || !manualEmails.trim()}
              className="w-full bg-[#193A40] text-white py-3 rounded-2xl text-xs font-bold cursor-pointer disabled:opacity-40 hover:opacity-90"
            >
              {isAddingManual ? "Registering..." : "Register Student(s) for Mess"}
            </button>
          </div>
        </form>
      </div>

      {/* Schedule Table / Row Builder Div at Bottom */}
      <div className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#B5DED4]">
          <div>
            <h2 className="text-sm font-bold text-[#193A40] flex items-center gap-2">
              <span>📅</span> Fast Day Menu Schedule Table (Date-wise Builder)
            </h2>
            <p className="text-xs text-[#193A40]/70 mt-0.5">Add rows, select dates (ensure today's live date is included), choose meal type, and specify items.</p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="bg-[#007F86] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add Schedule Row
          </button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {scheduleRows.map((row, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-[#E9F7F4]/30 p-3.5 rounded-2xl border border-[#B5DED4]">
              <div className="w-full sm:w-44">
                <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={row.date}
                  onChange={(e) => handleRowChange(idx, "date", e.target.value)}
                  className="w-full rounded-xl border border-[#B5DED4] bg-white px-3 py-2 text-xs font-medium outline-none text-[#193A40]"
                />
              </div>

              <div className="w-full sm:w-36">
                <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase mb-1">Meal Window</label>
                <select
                  value={row.meal}
                  onChange={(e) => handleRowChange(idx, "meal", e.target.value)}
                  className="w-full rounded-xl border border-[#B5DED4] bg-white px-3 py-2 text-xs font-bold outline-none capitalize text-[#193A40] cursor-pointer"
                >
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase mb-1">Menu Items (comma separated)</label>
                <input
                  type="text"
                  required
                  value={row.items}
                  onChange={(e) => handleRowChange(idx, "items", e.target.value)}
                  placeholder="Sabudana Khichdi, Curd, Banana"
                  className="w-full rounded-xl border border-[#B5DED4] bg-white px-3 py-2 text-xs font-semibold outline-none text-[#193A40]"
                />
              </div>

              <div className="sm:pt-5">
                <button
                  type="button"
                  onClick={() => handleRemoveRow(idx)}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                  title="Remove row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border-2 border-[#B5DED4] p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#B5DED4]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#193A40] flex items-center gap-2">
              <span>📋</span> Registered Students Directory ({filteredOptIns.length})
            </h2>
            <select
              value={selectedMessFilter}
              onChange={(e) => setSelectedMessFilter(e.target.value)}
              className="rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/40 px-3 py-1.5 text-xs font-bold outline-none cursor-pointer text-[#193A40]"
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
            <p className="py-12 text-center text-xs italic text-[#193A40]/60">No students registered for Fast Day special meals yet.</p>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#E9F7F4] sticky top-0">
                <tr className="border-b border-[#B5DED4] text-[10px] uppercase tracking-wider text-[#193A40]/70 font-bold">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Mess</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B5DED4]/60">
                {filteredOptIns.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#E9F7F4]/40">
                    <td className="py-3.5 px-4 font-bold text-[#193A40]">{item.name}</td>
                    <td className="py-3.5 px-4 text-[#193A40]/70">{item.email}</td>
                    <td className="py-3.5 px-4 font-bold uppercase text-[10px] text-[#007F86]">{item.messId}</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.source === "admin_manual_add" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.source === "admin_manual_add" ? "Manual Admin" : "Self Opt-In"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Remove ${item.name} from Fast Day registration?`)) {
                            await deleteDoc(doc(db!, "fast_day_opt_ins", item.id));
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

/* ---------------- 🌟 2. STUDENT PORTAL FAST DAY COMPONENT (COST-OPTIMIZED) ---------------- */
export function NavratriStudentWidget({ profile }: { profile: StudentProfile }) {
  const [config, setConfig] = useState<any>(null);
  
  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const cacheKey = useMemo(() => {
    return profile?.email ? `fast_day_status_${profile.email.toLowerCase()}_${todayDateStr}` : null;
  }, [profile?.email, todayDateStr]);

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

    const unsubConfig = onSnapshot(doc(db, "platform_config", "fast_day_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.enabled || data.optInEnabled) {
          setConfig(data);
        } else {
          setConfig(null);
        }
      }
    });

    if (cacheKey && localStorage.getItem(cacheKey) !== null) {
      return () => { unsubConfig(); };
    }

    const q = query(
      collection(db, "fast_day_opt_ins"),
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
    if (!confirm(`Are you sure you want to register for "${config?.eventLabel || 'Fast Day Special Menu'}" with your name (${profile.name}) and mess (${profile.messId.toUpperCase()})?`)) return;

    setIsOptingIn(true);
    try {
      await addDoc(collection(db, "fast_day_opt_ins"), {
        name: profile.name || "VIT Student",
        email: profile.email.toLowerCase(),
        messId: profile.messId || "jmb",
        source: "student_self_opt_in",
        createdAt: serverTimestamp(),
      });
      
      setHasOptedIn(true);
      setIsRegisteredForCorrectMess(true);

      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify(true));
      }

      alert("🌟 Successfully registered for Fast Day Special meals!");
    } catch (err) {
      console.error("Opt-in error:", err);
      alert("Failed to register. Please try again.");
    } finally {
      setIsOptingIn(false);
    }
  }

  if (!config) return null;

  const eventTitle = config.eventLabel || "Fast Day Special Menu Edition";
  const todayMenu = config.dailyMenusMap?.[todayDateStr] || { lunch: [], dinner: [] };
  const hasLunch = todayMenu.lunch && todayMenu.lunch.length > 0;
  const hasDinner = todayMenu.dinner && todayMenu.dinner.length > 0;

  return (
    <div className="space-y-4">
      {/* 1. Show Special Menu if Enabled and Student is Registered */}
      {config.enabled && isRegisteredForCorrectMess && (hasLunch || hasDinner) && (
        <div className="rounded-3xl border-2 border-[#B5DED4] bg-white p-5 shadow-sm text-[#193A40]">
          <div className="flex items-center justify-between pb-3 border-b border-[#B5DED4]/60">
            <div className="text-xs font-bold uppercase tracking-wider text-[#193A40] flex items-center gap-1.5">
              <span>✨</span> {eventTitle} ({todayDateStr})
            </div>
            <span className="text-[10px] font-bold bg-[#E9F7F4] text-[#007F86] px-2.5 py-0.5 rounded-md uppercase border border-[#B5DED4]">
              Registered Fasting Plate ({profile.messId.toUpperCase()})
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasLunch && (
              <div className="bg-[#E9F7F4]/30 border-2 border-[#B5DED4] p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#193A40]">
                  <span>🍽️</span>
                  <span>Lunch Fasting</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[#193A40]/80 border-t border-[#B5DED4]/60 pt-2">
                  {todayMenu.lunch.map((item: string, idx: number) => (
                    <li key={idx} className="font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#007F86] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasDinner && (
              <div className="bg-[#E9F7F4]/30 border-2 border-[#B5DED4] p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#193A40]">
                  <span>🌙</span>
                  <span>Dinner Fasting</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[#193A40]/80 border-t border-[#B5DED4]/60 pt-2">
                  {todayMenu.dinner.map((item: string, idx: number) => (
                    <li key={idx} className="font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#007F86] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Show Opt-In Card if Enabled and Student is NOT Registered */}
      {config.optInEnabled && !isRegisteredForCorrectMess && (
        <div className="rounded-2xl border-2 border-[#B5DED4] bg-white p-4 shadow-sm flex items-center justify-between gap-3 text-[#193A40]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#007F86]/10 text-[#007F86] flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#193A40]">{eventTitle} Registration</h4>
              <p className="text-[11px] text-[#193A40]/70">
                Are you sure? Register with your name ({profile.name}) &amp; mess ({profile.messId.toUpperCase()}) for special meals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOptIn}
            disabled={isOptingIn}
            className="bg-[#007F86] text-white hover:opacity-90 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isOptingIn ? "Registering..." : "Opt In"}
          </button>
        </div>
      )}

      {/* 3. Show Confirmation Badge if Registered */}
      {config.optInEnabled && isRegisteredForCorrectMess && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between gap-3 text-[#193A40]">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-900">{eventTitle} Registration Confirmed ({profile.messId.toUpperCase()})</span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-200/60 text-emerald-900 px-2.5 py-1 rounded-lg">
            Active
          </span>
        </div>
      )}
    </div>
  );
}