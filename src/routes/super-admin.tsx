import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase"; 
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, limit, doc, getDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { 
  getAdminSession, 
  saveAdminSession, 
  clearAdminSession, 
  verifyAdminPasscode,
  MESSES as DEFAULT_STATIC_MESSES,
  MEAL_DEFS,
  currentAndNextMeal,
  HARDCODED_WEEKLY_MENUS,
  deleteBroadcasts,
  toggleFeedbackStatus,
  type MealKey,
  type ItemFeedback
} from "@/lib/messhub";
import { 
  ShieldCheck, Users, Activity, MessageSquare, Megaphone, 
  LogOut, Menu, X, Clock, CheckSquare, Square, Star, 
  CheckCircle2, AlertCircle, Trash2, TrendingUp, Send, CheckCircle,
  PlusCircle, History, Utensils, Download, AlertTriangle, Lock, Unlock, KeyRound, Search
} from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Master Control SaaS Dashboard — MessHub" },
      { name: "description", content: "Platform super-admin infrastructure console and analytics." },
    ],
  }),
  component: SuperAdminGatekeeper,
});

/**
 * Audit Logger: Ensures only validated super-admin operators can write audit records.
 * Sanitize lengths and types to mitigate injection or payload bloat.
 */
async function logSuperAdminActivity(messId: string, action: string, details: string) {
  if (!db) return;
  try {
    const session = getAdminSession();
    if (!session || session.role !== "super-admin") return;
    await addDoc(collection(db, "admin_audit_logs"), {
      messId: String(messId || "all").slice(0, 50).trim(),
      action: String(action || "").slice(0, 100).trim(),
      details: String(details || "").slice(0, 500).trim(),
      operatorRole: "super-admin",
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write super admin audit log:", err);
  }
}

/**
 * Excel / CSV Formula Injection Guard:
 * Prevents execution of spreadsheet macros (=, +, -, @, \t, \r) injected via student remarks or names.
 */
function sanitizeExcelCell(val: any): string {
  if (val === null || val === undefined) return "N/A";
  const str = String(val).trim();
  if (/^[=+@\-\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function SuperAdminGatekeeper() {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const activeSession = getAdminSession();
    if (activeSession && activeSession.role !== "super-admin") {
      clearAdminSession();
      setSession(null);
    } else {
      setSession(activeSession);
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && session && session.role !== "super-admin") {
      navigate({ to: "/admin" });
    }
  }, [session, navigate, isMounted]);

  function handleVerifyPasscode(e: React.FormEvent) {
    e.preventDefault();
    const cleanPass = passcode.trim();
    const matchedAuth = verifyAdminPasscode(cleanPass);

    if (matchedAuth && matchedAuth.role === "super-admin") {
      setAuthError(false);
      const newSession = { role: matchedAuth.role };
      saveAdminSession(newSession);
      setSession(newSession);
      logSuperAdminActivity("all", "Root Login", "Super Admin authorized access to Master Control Dashboard");
    } else {
      setAuthError(true);
      setPasscode("");
      if ("vibrate" in navigator) navigator.vibrate(200);
    }
  }

  if (!isMounted) {
    return <div className="min-h-screen bg-[#1c1c1e]" />;
  }

  if (!session || session.role !== "super-admin") {
    return (
      <div className="min-h-screen bg-[#1c1c1e] flex flex-col justify-between px-6 py-12 text-white select-none font-sans">
        <header className="flex items-center justify-between w-full max-w-sm mx-auto">
          <Link to="/" className="text-sm font-semibold text-zinc-400 transition active:opacity-60">
            &larr; Exit
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Master Gate</span>
        </header>

        <main className="w-full max-w-sm mx-auto text-center flex-1 flex flex-col justify-center">
          <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center">
            <span className="text-zinc-400 text-xs font-bold">Root</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-6">Platform Master Key</h1>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-[240px] mx-auto">
            Authorized root authentication protocol layer required.
          </p>

          <form onSubmit={handleVerifyPasscode} className="mt-8">
            <input
              autoFocus
              type="password"
              value={passcode}
              onChange={(e) => { setAuthError(false); setPasscode(e.target.value); }}
              placeholder="••••••••"
              className={`w-full tracking-widest text-center rounded-2xl border bg-zinc-900 border-zinc-800 text-white px-4 py-4 text-lg font-bold outline-none transition-all ${
                authError ? "border-red-500 ring-4 ring-red-500/10" : "focus:border-zinc-400"
              }`}
            />
            {authError && <p className="mt-2.5 text-xs font-semibold text-red-400">Invalid authorization sequence.</p>}
            <button type="submit" disabled={passcode.length === 0} className="mt-4 w-full rounded-2xl bg-white py-4 text-sm font-bold text-black active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer">
              Verify Root Access
            </button>
          </form>
        </main>

        <footer className="text-center text-[10px] text-zinc-600 font-medium tracking-wide">
          MESSHUB SYSTEM INFRASTRUCTURE CONSOLE
        </footer>
      </div>
    );
  }

  return <PlatformMasterDashboard onSignOut={() => setSession(null)} />;
}

/* ---------------- 👑 PLATFORM MASTER SAAS DASHBOARD ---------------- */
function PlatformMasterDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "roles" | "feedbacks" | "complaints" | "broadcasts" | "students" | "analytics" | "audit">("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Realtime Datasets
  const [dynamicMesses, setDynamicMesses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<ItemFeedback[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [menuLogs, setMenuLogs] = useState<any[]>([]);
  const [broadcastList, setBroadcastList] = useState<any[]>([]);
  const [clickLogs, setClickLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Local Action States
  const [selectedMealKey, setSelectedMealKey] = useState<MealKey>("lunch");
  const [isFiringMealAlert, setIsFiringMealAlert] = useState(false);
  const [targetMessId, setTargetMessId] = useState<string>("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcastingCustom, setIsBroadcastingCustom] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 🔒 Master Kitchen Editing Permission State (Synced for Roles Tab)
  const [isMenuEditingUnlocked, setIsMenuEditingUnlocked] = useState(false);
  const [isUpdatingLock, setIsUpdatingLock] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // ⚡ Single-source Bounded Firebase Listeners
  useEffect(() => {
    if (!db) return;

    const configRef = doc(db, "platform_config", "settings");
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsMenuEditingUnlocked(!!docSnap.data().menuEditingEnabled);
      }
    });

    const unsubMesses = onSnapshot(collection(db, "messes"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDynamicMesses(list);
    });

    const studentsQuery = query(collection(db, "registered_students"), limit(1500));
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.lastActiveAt?.toDate?.()?.getTime() || 0) - (a.lastActiveAt?.toDate?.()?.getTime() || 0));
      setStudents(list);
    });

    // Load recent feedback submissions without composite queries to prevent indexing crashes
    const feedbacksQuery = query(collection(db, "item_feedback"), orderBy("createdAt", "desc"), limit(2000));
    const unsubFeedbacks = onSnapshot(feedbacksQuery, (snap) => {
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemFeedback)));
    }, (err) => {
      console.warn("Item feedbacks listener error:", err);
    });

    const complaintsQuery = query(collection(db, "complaints"), orderBy("createdAt", "desc"), limit(250));
    const unsubComplaints = onSnapshot(complaintsQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComplaints(list);
    }, (err) => {
      console.warn("Complaints listener fallback:", err);
    });

    const menuQuery = query(collection(db, "mess_menus"), orderBy("updatedAt", "desc"), limit(50));
    const unsubMenu = onSnapshot(menuQuery, (snap) => {
      setMenuLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    const broadcastsQuery = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(50));
    const unsubBroadcasts = onSnapshot(broadcastsQuery, (snap) => {
      setBroadcastList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const clicksQuery = query(collection(db, "broadcast_clicks"), limit(100));
    const unsubClicks = onSnapshot(clicksQuery, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => (b.clickedAt?.toDate?.()?.getTime() || 0) - (a.clickedAt?.toDate?.()?.getTime() || 0));
      setClickLogs(logs);
    });

    const auditQuery = query(collection(db, "admin_audit_logs"), orderBy("timestamp", "desc"), limit(100));
    const unsubAudit = onSnapshot(auditQuery, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Audit logs listener fallback:", err);
    });

    return () => {
      unsubConfig();
      unsubMesses();
      unsubStudents();
      unsubFeedbacks();
      unsubComplaints();
      unsubMenu();
      unsubBroadcasts();
      unsubClicks();
      unsubAudit();
    };
  }, []);

  async function handleSaveKitchenPermissions(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setIsUpdatingLock(true);
    setSaveSuccessNotice(false);
    try {
      const configRef = doc(db, "platform_config", "settings");
      await setDoc(configRef, {
        menuEditingEnabled: Boolean(isMenuEditingUnlocked),
        updatedAt: serverTimestamp(),
        updatedByRole: "super-admin"
      }, { merge: true });

      await logSuperAdminActivity(
        "all", 
        "Kitchen Permission Updated", 
        `Super Admin explicitly ${isMenuEditingUnlocked ? "GRANTED" : "REVOKED"} menu-editing access for Mess Admins.`
      );
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 4000);
    } catch (err) {
      console.error("Failed to update kitchen access state:", err);
      alert("Failed to save permission changes.");
    } finally {
      setIsUpdatingLock(false);
    }
  }

  const allMesses = useMemo(() => {
    const combined = [...DEFAULT_STATIC_MESSES];
    dynamicMesses.forEach((dm) => {
      if (!combined.some((m) => m.id === dm.id)) {
        combined.push({
          id: dm.id,
          name: dm.name || dm.id,
          subtitle: dm.subtitle || "",
        });
      }
    });
    return combined;
  }, [dynamicMesses]);

  const pendingFeedbacksCount = feedbacks.filter(f => f.status === "unsolved").length;
  const pendingComplaintsCount = complaints.filter(c => c.status !== "solved").length;

  const toggleSelectAll = () => {
    if (selectedIds.length === broadcastList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(broadcastList.map((b) => b.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleDeleteSelectedBroadcasts = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} broadcast announcement(s)?`)) return;

    setIsDeleting(true);
    try {
      await deleteBroadcasts(selectedIds);
      await logSuperAdminActivity("all", "Purged Broadcasts", `Removed ${selectedIds.length} broadcast announcements`);
      setSelectedIds([]);
    } catch (err) {
      alert("Error deleting broadcasts.");
    } finally {
      setIsDeleting(false);
    }
  };

  async function handleTriggerMealNotification() {
    if (!db) return;
    const selectedDef = MEAL_DEFS.find((m) => m.key === selectedMealKey);
    const mealName = selectedDef ? selectedDef.name : selectedMealKey;

    if (!window.confirm(`🚨 Transmit automated ${mealName} announcement across all student endpoints?`)) return;

    setIsFiringMealAlert(true);
    try {
      const pushTemplates: Record<string, { title: string; bodyPrefix: string }> = {
        breakfast: { title: "🍳 Breakfast Counter Open!", bodyPrefix: "Today's fuel is served: " },
        lunch: { title: "🍽️ Lunch is Served!", bodyPrefix: "Smells amazing right now! On the line: " },
        snacks: { title: "☕ High Tea / Snacks Ready!", bodyPrefix: "Time for a quick study break! Grab some: " },
        dinner: { title: "🌙 Dinner Window Open!", bodyPrefix: "Ready to wrap up your day? Tonight's spread: " },
      };

      const template = pushTemplates[selectedMealKey] || { 
        title: `🍽️ ${mealName} is Live!`, 
        bodyPrefix: "Check out today's selections: " 
      };

      const now = new Date();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      for (const mess of allMesses) {
        let items: string[] = [];

        try {
          const dailyDoc = await getDoc(doc(db, "daily_menus", `${mess.id}_${todayDateStr}`));
          if (dailyDoc.exists()) {
            const data = dailyDoc.data();
            const mealList = data?.[selectedMealKey] || [];
            items = mealList.map((d: any) => (typeof d === "string" ? d : d.name)).filter(Boolean);
          }
        } catch (e) {
          console.warn(`Could not fetch daily menu for ${mess.id}:`, e);
        }

        const itemSummary = items.length > 0
          ? items.slice(0, 3).join(", ") + (items.length > 3 ? "..." : "")
          : "Freshly cooked menu choices";

        const finalBodyText = `${template.bodyPrefix}${itemSummary}. Come down to the hall!`;

        await addDoc(collection(db, "broadcasts"), {
          messId: mess.id,
          title: template.title,
          body: finalBodyText,
          createdAt: serverTimestamp(),
        });
      }

      await logSuperAdminActivity("all", "Automated Meal Push", `Dispatched live announcement for ${mealName} across all messes`);
      alert(`🚀 Success! Menu announcement dispatched to student feeds!`);
    } catch (error) {
      console.error(error);
      alert("Meal transmission failure.");
    } finally {
      setIsFiringMealAlert(false);
    }
  }

  async function handleDeployCustomBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = broadcastTitle.trim().slice(0, 150);
    const cleanBody = broadcastBody.trim().slice(0, 1000);
    if (!cleanTitle || !cleanBody || !db) return;

    setIsBroadcastingCustom(true);
    try {
      await addDoc(collection(db, "broadcasts"), {
        messId: targetMessId,
        title: cleanTitle,
        body: cleanBody,
        createdAt: serverTimestamp(),
      });

      await logSuperAdminActivity(
        targetMessId,
        "Custom Broadcast Sent",
        `Target: ${targetMessId} | Title: "${cleanTitle}"`
      );

      setBroadcastTitle("");
      setBroadcastBody("");
      alert(`⚡ Custom broadcast successfully deployed to student feeds!`);
    } catch (error) {
      console.error("Broadcast deployment error:", error);
      alert("Custom broadcast failure. Please check console.");
    } finally {
      setIsBroadcastingCustom(false);
    }
  }

  const NavButton = ({ id, icon: Icon, label, badge }: any) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold transition-all text-xs cursor-pointer ${
        activeTab === id
          ? "bg-[#221510] text-white shadow-md"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4" /> <span>{label}</span>
      </div>
      {badge > 0 && (
        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px]">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#fbf7f2] flex flex-col lg:flex-row font-sans selection:bg-orange-200">
      
      {/* 📱 MOBILE TOPBAR */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b px-5 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-lg text-foreground">
          <ShieldCheck className="w-6 h-6 text-primary" /> Master HQ
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-zinc-100 rounded-xl cursor-pointer">
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 🖥️ SAAS SIDEBAR */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? "translate-x-0 top-[73px]" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="hidden lg:flex items-center gap-2.5 font-black text-xl text-foreground p-6 border-b border-border">
          <div className="h-9 w-9 rounded-xl gradient-warm flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span>MessHub HQ</span>
        </div>
        
        <div className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 mt-2">Infrastructure</p>
          <NavButton id="overview" icon={Activity} label="HQ Overview" />
          <NavButton id="roles" icon={KeyRound} label="Roles & Permissions" />
          <NavButton id="feedbacks" icon={MessageSquare} label="Campus Feedback" badge={pendingFeedbacksCount} />
          <NavButton id="complaints" icon={AlertTriangle} label="Campus Complaints" badge={pendingComplaintsCount} />
          <NavButton id="broadcasts" icon={Megaphone} label="Broadcast Management" />
          <NavButton id="students" icon={Users} label="Student Directory" />
          <NavButton id="analytics" icon={TrendingUp} label="Dish Ratings & Telemetry" />
          <NavButton id="audit" icon={History} label="System Audit Logs" badge={auditLogs.length} />
        </div>

        <div className="p-4 border-t border-border">
          <button 
            onClick={() => { 
              logSuperAdminActivity("all", "Root Logout", "Super Admin logged out");
              clearAdminSession(); 
              onSignOut(); 
            }} 
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-bold hover:bg-red-50 rounded-2xl transition text-xs cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> End Root Session
          </button>
        </div>
      </aside>

      {/* 📊 MAIN CONTENT CONTAINER */}
      <main className="flex-1 p-4 sm:p-8 lg:p-10 w-full max-w-[1600px] mx-auto overflow-y-auto h-screen">
        
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">Infrastructure Overview</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Real-time system telemetry and campus metrics.</p>
              </div>
              <Link
                to="/add-mess"
                className="gradient-warm text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-card transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" /> Add New Mess &amp; Menu
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Registered Students" 
                value={students.length} 
                icon={Users} 
                color="bg-blue-50 text-blue-600" 
                onClick={() => setActiveTab("students")}
              />
              <MetricCard 
                title="Mess Facilities" 
                value={allMesses.length} 
                icon={Utensils} 
                color="bg-purple-50 text-purple-600" 
              />
              <MetricCard 
                title="Pending Feedback" 
                value={pendingFeedbacksCount} 
                icon={MessageSquare} 
                color="bg-amber-50 text-amber-600" 
                alert={pendingFeedbacksCount > 0} 
                onClick={() => setActiveTab("feedbacks")}
              />
              <MetricCard 
                title="Open Complaints" 
                value={pendingComplaintsCount} 
                icon={AlertTriangle} 
                color="bg-red-50 text-red-600" 
                alert={pendingComplaintsCount > 0} 
                onClick={() => setActiveTab("complaints")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-border p-5 shadow-card flex flex-col h-[460px]">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-primary" /> Mess Facilities &amp; Active Management ({allMesses.length})
                  </h2>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                    100% Operational
                  </span>
                </div>
                <div className="mt-3 overflow-y-auto flex-1 space-y-3 pr-1">
                  {allMesses.map((mess) => {
                    const userCount = students.filter(s => s.messId === mess.id).length;
                    const authKeyEntry = DEFAULT_STATIC_MESSES.find((m) => m.id === mess.id);
                    const adminRole = authKeyEntry ? "admin" : "Unassigned";

                    return (
                      <div key={mess.id} className="bg-[#fbf7f2] border border-border/70 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{mess.name} {mess.subtitle ? `(${mess.subtitle})` : ""}</span>
                            <span className="text-[9px] font-bold uppercase bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded">ID: {mess.id}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                            Assigned Role: <span className="font-bold text-foreground capitalize">{adminRole}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-primary">{userCount}</span>
                          <p className="text-[9px] text-muted-foreground uppercase font-bold">Students</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-border p-5 shadow-card flex flex-col h-[460px]">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Live Menu Audit Trail
                  </h2>
                  <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">
                    Recent Updates
                  </span>
                </div>
                <div className="mt-3 overflow-y-auto flex-1 space-y-2 pr-1">
                  {menuLogs.length === 0 ? (
                    <p className="py-12 text-center text-xs italic text-muted-foreground">No menu modifications recorded yet.</p>
                  ) : (
                    menuLogs.map((log) => (
                      <div key={log.id} className="bg-[#fbf7f2] border border-border/60 p-3 rounded-2xl flex items-start gap-3">
                        <div className={`p-2 rounded-xl text-xs font-bold ${log.updatedByRole === "nutritionist" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {log.updatedByRole === "nutritionist" ? "Nutritionist" : "Mess Admin"} modified schedule
                          </p>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mt-0.5">
                            Target Node: {log.id.replace(/_/g, " ").toUpperCase()}
                          </p>
                          <p className="text-[9px] text-zinc-400 mt-1 font-medium">
                            {log.updatedAt?.seconds ? new Date(log.updatedAt.seconds * 1000).toLocaleString() : "Just now"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 1.5: ROLES & PERMISSIONS ================= */}
        {activeTab === "roles" && (
          <div className="space-y-6 animate-fade-in pb-12 max-w-3xl">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Roles &amp; Kitchen Permissions</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Control operational access and menu-editing privileges across campus mess panels.</p>
            </div>

            <form onSubmit={handleSaveKitchenPermissions} className="bg-white rounded-3xl border border-border p-6 shadow-card space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="h-10 w-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Mess Admin Menu Editing Control</h2>
                  <p className="text-xs text-muted-foreground">Dynamically grant or revoke permission for standard Mess Admins to modify daily food items.</p>
                </div>
              </div>

              <div className="bg-[#fbf7f2] border border-border p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground block">
                    {isMenuEditingUnlocked ? "🔓 Menu Editing Status: UNLOCKED" : "🔒 Menu Editing Status: LOCKED"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {isMenuEditingUnlocked 
                      ? "Mess Admins are currently permitted to update and overwrite daily menu items." 
                      : "Mess Admins are restricted. Only Super Admin authorization allows menu modifications."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuEditingUnlocked(!isMenuEditingUnlocked)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-2 shrink-0 ${
                    isMenuEditingUnlocked 
                      ? "bg-emerald-600 text-white" 
                      : "bg-zinc-900 text-white"
                  }`}
                >
                  {isMenuEditingUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {isMenuEditingUnlocked ? "Unlocked" : "Locked"}
                </button>
              </div>

              {saveSuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  Kitchen permissions successfully saved and synchronized across all dashboards!
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingLock}
                  className="gradient-warm text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-card transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {isUpdatingLock ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 2: CAMPUS FEEDBACK ================= */}
        {activeTab === "feedbacks" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Campus Feedback Hub</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Track student dish quality ratings, comments, and issue resolution status.</p>
            </div>
            <SuperAdminFeedbackViewer feedbacks={feedbacks} />
          </div>
        )}

        {/* ================= TAB 3: CAMPUS COMPLAINTS ================= */}
        {activeTab === "complaints" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Student Complaints &amp; Error Reports</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Review portal bug reports, service complaints, and manage resolution statuses.</p>
            </div>
            <SuperAdminComplaintsViewer complaints={complaints} />
          </div>
        )}

        {/* ================= TAB 4: BROADCAST MANAGEMENT ================= */}
        {activeTab === "broadcasts" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Broadcast Management Console</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Deploy automated meal templates or custom alerts, and govern active notification feeds.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-3xl border border-border bg-white p-5 shadow-card flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <span>🚀</span> Automated Meal Alert Push
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selects active service window, pulls current menu options, and triggers live system push notifications across campus.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Active Service Window:</label>
                      <select
                        value={selectedMealKey}
                        onChange={(e) => setSelectedMealKey(e.target.value as MealKey)}
                        className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-white transition cursor-pointer"
                      >
                        {MEAL_DEFS.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.icon} {m.name} Setup Template
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerMealNotification}
                  disabled={isFiringMealAlert}
                  className="mt-6 w-full rounded-2xl gradient-warm py-3.5 text-xs font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isFiringMealAlert ? "Syncing Menu Assets..." : "Transmit Live Meal Alerts to All Devices"}
                </button>
              </div>

              <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
                <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                  <span>📢</span> Custom Channel Broadcast
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Draft announcements and deliver them dynamically to targeted dining facilities or a global campus blast.
                </p>

                <form onSubmit={handleDeployCustomBroadcast} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Channel Node:</label>
                    <select
                      value={targetMessId}
                      onChange={(e) => setTargetMessId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition cursor-pointer"
                    >
                      <option value="all">🌍 All Messes (Global Broadcast)</option>
                      {allMesses.map((m) => (
                        <option key={m.id} value={m.id}>🏢 {m.name} {m.subtitle ? `(${m.subtitle})` : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Heading Title:</label>
                    <input
                      required
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="Enter alert header text..."
                      className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Message Content:</label>
                    <textarea
                      required
                      rows={2}
                      maxLength={500}
                      value={broadcastBody}
                      onChange={(e) => setBroadcastBody(e.target.value)}
                      placeholder="Type your message details here..."
                      className="w-full resize-none rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:bg-white transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isBroadcastingCustom || !broadcastTitle.trim() || !broadcastBody.trim()}
                    className="w-full rounded-2xl bg-black py-3 text-xs font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {isBroadcastingCustom ? "Dispersing..." : "Disperse Custom Announcement"}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <span>📋</span> Active Broadcast Control Registry
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select and purge outdated broadcast logs in real time.</p>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteSelectedBroadcasts}
                  disabled={selectedIds.length === 0 || isDeleting}
                  className="rounded-xl bg-red-500 px-3.5 py-2 text-xs font-bold text-white shadow-card transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected ({selectedIds.length})</span>
                </button>
              </div>

              <div className="mt-4 overflow-x-auto max-h-[350px] overflow-y-auto pr-1">
                {broadcastList.length === 0 ? (
                  <p className="py-8 text-center text-xs italic text-muted-foreground">No active announcements found in Firestore.</p>
                ) : (
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === broadcastList.length && broadcastList.length > 0}
                            onChange={toggleSelectAll}
                            className="h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Target Node</th>
                        <th className="py-2.5 px-3">Heading</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {broadcastList.map((b) => {
                        const isChecked = selectedIds.includes(b.id);
                        return (
                          <tr key={b.id} className={`transition hover:bg-[#fbf7f2] ${isChecked ? "bg-red-50/50" : ""}`}>
                            <td className="py-3 px-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectOne(b.id)}
                                className="h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3 font-bold uppercase text-[10px] text-red-500">
                              {b.messId}
                            </td>
                            <td className="py-3 px-3 font-medium text-foreground max-w-[280px] truncate">
                              {b.title}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm("Delete this broadcast announcement?")) {
                                    await deleteBroadcasts([b.id]);
                                    await logSuperAdminActivity(b.messId, "Broadcast Deleted", `Deleted broadcast: "${b.title}"`);
                                  }
                                }}
                                className="rounded-lg bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-500 hover:text-white transition cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: STUDENT DIRECTORY ================= */}
        {activeTab === "students" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">Student Onboarding Directory</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Comprehensive real-time directory of every student authenticated on MessHub.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (students.length === 0) {
                    alert("No student records available to export.");
                    return;
                  }
                  const rows = students.map((s) => ({
                    "Student Name": sanitizeExcelCell(s.name || "Anonymous"),
                    "Email": sanitizeExcelCell(s.email || "N/A"),
                    "Assigned Mess": sanitizeExcelCell(s.messId || "N/A"),
                    "Last Active": s.lastActiveAt?.toDate ? s.lastActiveAt.toDate().toLocaleString("en-IN") : "Recent"
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "StudentDirectory");
                  XLSX.writeFile(wb, `MessHub_Students_${new Date().toISOString().split("T")[0]}.xlsx`);
                  logSuperAdminActivity("all", "Export Students", "Super Admin exported student directory to Excel");
                }}
                className="gradient-warm text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-card transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-4 h-4" /> Export Student Directory to Excel
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-border p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>👥</span> Active Onboarded Profiles
                </h2>
                <span className="rounded-full bg-emerald-100 text-emerald-700 font-bold px-3 py-1 text-xs">
                  Total Students: {students.length}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                {students.length === 0 ? (
                  <p className="py-12 text-center text-xs italic text-muted-foreground">No student onboarding entries recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Assigned Mess</th>
                        <th className="py-3 px-4 text-right">Joined / Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {students.map((student, idx) => (
                        <tr key={student.id || idx} className="transition hover:bg-[#fbf7f2]">
                          <td className="py-3.5 px-4 font-bold text-foreground">{student.name || "Anonymous"}</td>
                          <td className="py-3.5 px-4 text-muted-foreground">{student.email || "N/A"}</td>
                          <td className="py-3.5 px-4 font-bold uppercase text-[10px] text-red-500">{student.messId || "N/A"}</td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground text-[10px]">
                            {student.lastActiveAt?.toDate ? student.lastActiveAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Just now"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: DISH RATINGS & TELEMETRY ================= */}
        {activeTab === "analytics" && (
          <MessDishRatingsTab allMesses={allMesses} rawFeedbacks={feedbacks} />
        )}

        {/* ================= TAB 7: MASTER AUDIT LOGS ================= */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Platform Audit Logs</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Immutable record of all super admin and operator actions across campus.</p>
            </div>

            <div className="bg-white rounded-3xl border border-border p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> System Events Feed
                </h2>
                <span className="rounded-full bg-zinc-100 text-zinc-700 font-bold px-3 py-1 text-xs">
                  {auditLogs.length} Operations Logged
                </span>
              </div>

              <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="py-12 text-center text-xs italic text-muted-foreground">No audit logs recorded yet.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-[#fbf7f2] border border-border/80 rounded-2xl flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{log.action}</span>
                          <span className="text-[9px] font-bold uppercase bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded">
                            {log.operatorRole || "admin"}
                          </span>
                          <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                            {log.messId}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] font-medium">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 font-semibold shrink-0">
                        {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Just now"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

/* ---------------- 🍲 DEDICATED DISH-BY-DISH MEAL RATINGS & AUDIT COMPONENT ---------------- */
function MessDishRatingsTab({ allMesses, rawFeedbacks }: { allMesses: any[]; rawFeedbacks: ItemFeedback[] }) {
  const [selectedMessId, setSelectedMessId] = useState<string>(allMesses[0]?.id || "jmb");
  
  // Auto-detect live serving meal window or fallback to lunch
  const { current: liveMeal } = useMemo(() => currentAndNextMeal(new Date()), []);
  const [selectedMeal, setSelectedMeal] = useState<MealKey | "all">(() => liveMeal?.key || "lunch");
  
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("all");
  const [menuItemsMap, setMenuItemsMap] = useState<Record<MealKey, string[]>>({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: []
  });
  const [searchQuery, setSearchQuery] = useState("");

  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const activeWeekday = new Date().getDay();

  // 1. Fetch live daily menu from Firestore with weekly fallback
  useEffect(() => {
    if (!db || !selectedMessId) return;

    async function loadMenuData() {
      try {
        const dailyDocRef = doc(db, "daily_menus", `${selectedMessId}_${todayDateStr}`);
        const dailySnap = await getDoc(dailyDocRef);

        let menuPayload: any = null;
        if (dailySnap.exists()) {
          menuPayload = dailySnap.data();
        } else {
          const weeklyDocRef = doc(db, "mess_menus", `${selectedMessId}_${activeWeekday}`);
          const weeklySnap = await getDoc(weeklyDocRef);
          if (weeklySnap.exists()) {
            menuPayload = weeklySnap.data();
          } else {
            menuPayload = HARDCODED_WEEKLY_MENUS[selectedMessId]?.[activeWeekday] || null;
          }
        }

        const map: Record<MealKey, string[]> = { breakfast: [], lunch: [], snacks: [], dinner: [] };
        if (menuPayload) {
          MEAL_DEFS.forEach((m) => {
            const rawList = menuPayload[m.key] || [];
            map[m.key] = rawList.map((item: any) => typeof item === "object" ? item.name : item).filter(Boolean);
          });
        }
        setMenuItemsMap(map);
      } catch (err) {
        console.error("Error loading menu for dish ratings tab:", err);
      }
    }

    loadMenuData();
  }, [selectedMessId, todayDateStr, activeWeekday]);

  // 2. Safe in-memory filtering: avoids composite index errors in Firestore
  const filteredFeedbacks = useMemo(() => {
    const now = new Date();
    return rawFeedbacks.filter((f) => {
      if (f.messId !== selectedMessId) return false;
      if (timeRange === "all") return true;
      const fDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date();

      if (timeRange === "day") {
        return fDate.toDateString() === now.toDateString();
      }
      if (timeRange === "week") {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return fDate >= oneWeekAgo;
      }
      if (timeRange === "month") {
        return fDate.getMonth() === now.getMonth() && fDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [rawFeedbacks, selectedMessId, timeRange]);

  // 3. Compute per-dish ratings and aggregate across meal periods
  const dishGroupAnalytics = useMemo(() => {
    const dishScores: Record<string, { total: number; count: number; stars: Record<number, number>; mealKey: string }> = {};

    filteredFeedbacks.forEach((f) => {
      if (!f.itemName) return;
      const key = f.itemName.trim().toLowerCase();
      const r = Math.min(5, Math.max(1, Math.round(f.rating || 5)));
      
      if (!dishScores[key]) {
        dishScores[key] = {
          total: 0,
          count: 0,
          stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          mealKey: f.mealKey || "lunch"
        };
      }
      dishScores[key].total += f.rating || 0;
      dishScores[key].count += 1;
      dishScores[key].stars[r] = (dishScores[key].stars[r] || 0) + 1;
    });

    const categories: Record<MealKey, any[]> = {
      breakfast: [],
      lunch: [],
      snacks: [],
      dinner: []
    };

    MEAL_DEFS.forEach((m) => {
      const items = menuItemsMap[m.key] || [];
      const analyzedItems = items.map((itemName) => {
        const key = itemName.trim().toLowerCase();
        const stat = dishScores[key];
        const count = stat ? stat.count : 0;
        const avg = count > 0 ? (stat.total / count).toFixed(1) : "Unrated";
        const stars = stat ? stat.stars : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        return {
          name: itemName,
          mealKey: m.key,
          avg,
          count,
          stars
        };
      });

      // Include ratings logged for dishes outside the static list
      Object.entries(dishScores).forEach(([k, stat]) => {
        if (stat.mealKey === m.key && !items.some(it => it.trim().toLowerCase() === k)) {
          const formattedName = k.charAt(0).toUpperCase() + k.slice(1);
          analyzedItems.push({
            name: formattedName,
            mealKey: m.key,
            avg: (stat.total / stat.count).toFixed(1),
            count: stat.count,
            stars: stat.stars
          });
        }
      });

      categories[m.key] = analyzedItems;
    });

    return categories;
  }, [filteredFeedbacks, menuItemsMap]);

  // Overall facility metrics calculation
  const overallFacilityMetrics = useMemo(() => {
    let sum = 0;
    let count = 0;
    filteredFeedbacks.forEach((f) => {
      sum += f.rating || 0;
      count++;
    });
    return {
      avg: count > 0 ? (sum / count).toFixed(2) : "0.0",
      total: count
    };
  }, [filteredFeedbacks]);

  // Comprehensive Multi-Sheet Excel Telemetry Generator with Formula Injection Defense
  function exportCleanMealReportToExcel() {
    if (filteredFeedbacks.length === 0) {
      alert("⚠️ No feedback submissions available for this facility and timeframe.");
      return;
    }

    const currentMess = allMesses.find((m) => m.id === selectedMessId);
    const messTitle = currentMess ? `${currentMess.name} ${currentMess.subtitle || ""}` : selectedMessId;

    // --- SHEET 1: EXECUTIVE AUDIT & OVERVIEW ---
    const summarySheetRows = [
      { Parameter: "Campus Mess Facility", Value: sanitizeExcelCell(messTitle) },
      { Parameter: "Facility System ID", Value: sanitizeExcelCell(selectedMessId.toUpperCase()) },
      { Parameter: "Selected Filter Timeframe", Value: sanitizeExcelCell(timeRange.toUpperCase()) },
      { Parameter: "Active / Live Service Window", Value: sanitizeExcelCell(liveMeal ? liveMeal.name : "Off-Service Hours") },
      { Parameter: "Facility Overall Star Rating", Value: `${overallFacilityMetrics.avg} / 5.0 ⭐` },
      { Parameter: "Total Reviews Recorded", Value: overallFacilityMetrics.total },
      { Parameter: "Export Operator Role", Value: "Super-Admin (Root)" },
      { Parameter: "Report Generation Timestamp", Value: new Date().toLocaleString("en-IN") },
    ];

    // --- SHEET 2: ALL MEALS DISH PERFORMANCE MATRIX ---
    const detailedDishRows: any[] = [];
    MEAL_DEFS.forEach((m) => {
      const mealItems = dishGroupAnalytics[m.key] || [];
      mealItems.forEach((d) => {
        const avgNum = parseFloat(d.avg);
        const qualityStatus = isNaN(avgNum) 
          ? "Unrated" 
          : avgNum >= 4.0 
            ? "High Rating" 
            : avgNum <= 2.5 
              ? "Needs Inspection" 
              : "Standard";

        detailedDishRows.push({
          "Meal Session": sanitizeExcelCell(m.name),
          "Meal Key": sanitizeExcelCell(m.key.toUpperCase()),
          "Dish Name": sanitizeExcelCell(d.name),
          "Average Star Rating": d.avg === "Unrated" ? "Unrated" : `${d.avg} ⭐`,
          "Total Student Reviews": d.count,
          "5 Star Reviews": d.stars[5] || 0,
          "4 Star Reviews": d.stars[4] || 0,
          "3 Star Reviews": d.stars[3] || 0,
          "2 Star Reviews": d.stars[2] || 0,
          "1 Star Reviews": d.stars[1] || 0,
          "Quality Health Check": qualityStatus,
        });
      });
    });

    // --- SHEET 3: MEAL CATEGORY SUMMARY (BREAKFAST vs LUNCH vs SNACKS vs DINNER) ---
    const categorySummaryRows = MEAL_DEFS.map((m) => {
      const mealItems = dishGroupAnalytics[m.key] || [];
      let totalMealVotes = 0;
      let totalMealScore = 0;

      mealItems.forEach((d) => {
        if (d.count > 0 && d.avg !== "Unrated") {
          totalMealVotes += d.count;
          totalMealScore += parseFloat(d.avg) * d.count;
        }
      });

      const categoryAvg = totalMealVotes > 0 ? (totalMealScore / totalMealVotes).toFixed(2) : "0.0";

      return {
        "Meal Period": sanitizeExcelCell(m.name),
        "Schedule Timing": `${m.startH.toString().padStart(2, "0")}:${m.startM.toString().padStart(2, "0")} - ${m.endH.toString().padStart(2, "0")}:${m.endM.toString().padStart(2, "0")}`,
        "Total Menu Items": mealItems.length,
        "Total Student Ratings": totalMealVotes,
        "Average Meal Score": `${categoryAvg} / 5.0 ⭐`,
      };
    });

    // --- SHEET 4: ITEMIZED STUDENT SUBMISSIONS (RAW FEEDBACK LOG) ---
    const rawFeedbacksData = filteredFeedbacks.map((f) => ({
      "Timestamp": f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString("en-IN") : "Recent",
      "Student Name": sanitizeExcelCell(f.studentName || "Anonymous Student"),
      "Student Email": sanitizeExcelCell(f.studentEmail || "N/A"),
      "Assigned Mess": sanitizeExcelCell(f.messId?.toUpperCase() || selectedMessId.toUpperCase()),
      "Meal Service": sanitizeExcelCell(f.mealKey ? f.mealKey.toUpperCase() : "GENERAL"),
      "Dish Item": sanitizeExcelCell(f.itemName),
      "Rating Awarded": Number(f.rating) || 5,
      "Student Comment": sanitizeExcelCell(f.comment || "No specific remark provided"),
      "Resolution Status": f.status === "solved" ? "Resolved" : "Pending Action",
    }));

    // Build Excel Workbook
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summarySheetRows);
    const wsDishes = XLSX.utils.json_to_sheet(detailedDishRows);
    const wsCategory = XLSX.utils.json_to_sheet(categorySummaryRows);
    const wsRaw = XLSX.utils.json_to_sheet(rawFeedbacksData);

    const setColWidths = (ws: XLSX.WorkSheet) => {
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
      const colWidths = (data[0] || []).map((_, colIdx) => ({
        wch: Math.max(...data.map((row) => (row[colIdx] ? String(row[colIdx]).length + 4 : 12)), 14),
      }));
      ws["!cols"] = colWidths;
    };

    setColWidths(wsSummary);
    setColWidths(wsDishes);
    setColWidths(wsCategory);
    setColWidths(wsRaw);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Audit");
    XLSX.utils.book_append_sheet(wb, wsDishes, "Meals & Dish Matrix");
    XLSX.utils.book_append_sheet(wb, wsCategory, "Meal Sessions Summary");
    XLSX.utils.book_append_sheet(wb, wsRaw, "Itemized Feedback Logs");

    const sanitizedFileNameMess = selectedMessId.replace(/[^a-zA-Z0-9_-]/g, "");
    XLSX.writeFile(
      wb,
      `MessHub_Detailed_Audit_${sanitizedFileNameMess.toUpperCase()}_${new Date().toISOString().split("T")[0]}.xlsx`
    );

    logSuperAdminActivity(
      selectedMessId,
      "Excel Audit Export",
      `Super Admin downloaded detailed meals & dish rating matrix for ${selectedMessId.toUpperCase()}`
    );
  }

  const activeCategoryList = useMemo(() => {
    let list: any[] = [];
    if (selectedMeal === "all") {
      MEAL_DEFS.forEach(m => {
        list = [...list, ...dishGroupAnalytics[m.key]];
      });
    } else {
      list = dishGroupAnalytics[selectedMeal] || [];
    }

    if (searchQuery.trim()) {
      list = list.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    }
    return list;
  }, [dishGroupAnalytics, selectedMeal, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Dish Ratings &amp; Telemetry</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Full itemized rating distributions across meal counters for <span className="font-bold text-primary">{selectedMessId.toUpperCase()}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 bg-white border border-border p-1 rounded-2xl shadow-card">
            {(["day", "week", "month", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-xl capitalize transition cursor-pointer ${
                  timeRange === t ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "day" ? "Today" : t === "week" ? "Past 7 Days" : t === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>

          {/* Facility Selector */}
          <div className="flex items-center gap-2 bg-white border border-border p-1.5 rounded-2xl shadow-card">
            <select
              value={selectedMessId}
              onChange={(e) => setSelectedMessId(e.target.value)}
              className="rounded-xl border border-border bg-[#fbf7f2] px-3 py-1.5 text-xs font-bold outline-none focus:border-primary cursor-pointer"
            >
              {allMesses.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.subtitle ? `(${m.subtitle})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={exportCleanMealReportToExcel}
            className="gradient-warm text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-card transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export Report to Excel
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-border shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Facility Average</p>
            <p className="text-3xl font-black text-foreground flex items-center gap-1.5">
              {overallFacilityMetrics.avg} <span className="text-amber-500 text-xl">⭐</span>
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-border shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Dish Reviews</p>
            <p className="text-3xl font-black text-foreground">{overallFacilityMetrics.total}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-border shadow-card flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Live Meal Serving</p>
            <p className="text-2xl font-black text-foreground capitalize flex items-center gap-1.5">
              {liveMeal ? `${liveMeal.name}` : "Off Hours"}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-orange-50 text-orange-600">
            <Utensils className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Interactive Meal Session Filter Bar */}
      <div className="bg-white rounded-3xl border border-border p-2.5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedMeal("all")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              selectedMeal === "all"
                ? "bg-[#221510] text-white shadow-xs"
                : "text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
            }`}
          >
            All Meals
          </button>

          {MEAL_DEFS.map((m) => {
            const isLive = liveMeal?.key === m.key;
            const isSelected = selectedMeal === m.key;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMeal(m.key)}
                className={`relative px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#221510] text-white shadow-xs"
                    : "text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
                {isLive && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Live Now" />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search dish in spread..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-[#fbf7f2] pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Dish Ratings Table */}
      <div className="bg-white rounded-3xl border border-border p-5 shadow-card">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Utensils className="w-4 h-4 text-primary" /> Active Dish Spread ({activeCategoryList.length} items)
          </h2>
          <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md uppercase">
            {selectedMeal === "all" ? "Combined Spread" : `${selectedMeal} Session`}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto max-h-[550px] overflow-y-auto">
          {activeCategoryList.length === 0 ? (
            <p className="py-12 text-center text-xs italic text-muted-foreground">No dishes found for this meal category or search query.</p>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-50 sticky top-0">
                <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Dish Name</th>
                  <th className="py-3 px-4">Meal</th>
                  <th className="py-3 px-4">Average Rating</th>
                  <th className="py-3 px-4">Total Reviews</th>
                  <th className="py-3 px-4">Star Distribution (5★ to 1★)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeCategoryList.map((dish, idx) => (
                  <tr key={idx} className="transition hover:bg-[#fbf7f2]">
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {dish.name}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[10px] uppercase text-zinc-500">
                      {dish.mealKey}
                    </td>
                    <td className="py-3.5 px-4 font-black text-sm">
                      {dish.avg === "Unrated" ? (
                        <span className="text-zinc-400 font-semibold text-xs">Unrated</span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1">
                          {dish.avg} <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-muted-foreground">
                      {dish.count} reviews
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                          5★: {dish.stars[5]}
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                          4★: {dish.stars[4]}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                          3★: {dish.stars[3]}
                        </span>
                        <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
                          2★: {dish.stars[2]}
                        </span>
                        <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                          1★: {dish.stars[1]}
                        </span>
                      </div>
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

/* ---------------- 🧩 UI HELPER COMPONENTS ---------------- */

function MetricCard({ title, value, icon: Icon, color, alert, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white p-5 rounded-3xl border border-border shadow-card flex items-center justify-between relative overflow-hidden transition ${
        onClick ? "cursor-pointer hover:border-primary hover:shadow-lg active:scale-[0.99]" : ""
      }`}
    >
      {alert && <span className="absolute top-0 right-0 w-2 h-full bg-red-500 animate-pulse" />}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-foreground">{value}</p>
      </div>
      <div className={`p-3.5 rounded-2xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

function SuperAdminFeedbackViewer({ feedbacks }: { feedbacks: ItemFeedback[] }) {
  const [filter, setFilter] = useState<"all" | "unsolved" | "solved">("all");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("all");

  const filtered = feedbacks.filter((f) => {
    const isSolved = f.status === "solved";
    if (filter === "unsolved" && isSolved) return false;
    if (filter === "solved" && !isSolved) return false;

    if (timeRange === "all") return true;
    const fDate = f.createdAt?.toDate ? f.createdAt.toDate() : new Date();
    const now = new Date();

    if (timeRange === "day") return fDate.toDateString() === now.toDateString();
    if (timeRange === "week") {
      const ago = new Date();
      ago.setDate(now.getDate() - 7);
      return fDate >= ago;
    }
    if (timeRange === "month") return fDate.getMonth() === now.getMonth() && fDate.getFullYear() === now.getFullYear();
    return true;
  });

  function exportFeedbackToExcel() {
    if (filtered.length === 0) {
      alert("No feedback records available for this timeframe.");
      return;
    }

    const exportRows = filtered.map((f) => ({
      "Date / Time": f.createdAt?.toDate ? f.createdAt.toDate().toLocaleString("en-IN") : "Recent",
      "Student Name": sanitizeExcelCell(f.studentName),
      "Student Email": sanitizeExcelCell(f.studentEmail || ""),
      "Mess Facility": sanitizeExcelCell(f.messId),
      "Meal": sanitizeExcelCell(f.mealKey),
      "Dish Name": sanitizeExcelCell(f.itemName),
      "Rating (Out of 5)": Number(f.rating) || 0,
      "Feedback Comment": sanitizeExcelCell(f.comment || ""),
      "Resolution Status": f.status === "solved" ? "Resolved" : "Pending"
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CampusFeedback");
    XLSX.writeFile(wb, `MessHub_Feedback_${timeRange}_${new Date().toISOString().split("T")[0]}.xlsx`);
    logSuperAdminActivity("all", "Export Feedbacks", "Super Admin exported campus feedbacks to Excel");
  }

  return (
    <div className="bg-white border border-border rounded-3xl p-5 shadow-card space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-border w-fit">
            {(["all", "unsolved", "solved"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                  filter === type ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-border w-fit">
            {(["day", "week", "month", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                  timeRange === t ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "day" ? "Today" : t === "week" ? "Past Week" : t === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={exportFeedbackToExcel}
          className="text-xs font-bold text-slate-700 bg-background hover:bg-slate-100 border border-border px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs self-start lg:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" /> Export Filtered Feedbacks
        </button>
      </div>

      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-xs italic text-muted-foreground">No feedback entries found matching timeframe &amp; filter.</p>
        ) : (
          filtered.map((item) => {
            const isSolved = item.status === "solved";
            return (
              <div 
                key={item.id} 
                className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                  isSolved ? "bg-emerald-50/40 border-emerald-300 opacity-70" : "bg-white border-border shadow-xs"
                }`}
              >
                <button
                  type="button"
                  onClick={async () => {
                    if (!item.id) return;
                    await toggleFeedbackStatus(item.id, item.status);
                    await logSuperAdminActivity(
                      item.messId,
                      "Feedback Resolution",
                      `Toggled feedback for "${item.itemName}" to ${isSolved ? "Unsolved" : "Solved"}`
                    );
                  }}
                  className="mt-1 shrink-0 text-primary hover:scale-110 transition cursor-pointer"
                  title={isSolved ? "Mark Unsolved" : "Mark Solved"}
                >
                  {isSolved ? <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" /> : <Square className="w-5 h-5 text-zinc-400" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-bold text-sm truncate ${isSolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.itemName} <span className="uppercase text-[10px] text-muted-foreground ml-1 font-semibold">({item.mealKey})</span>
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`w-3.5 h-3.5 ${star <= item.rating ? "fill-amber-500 text-amber-500" : "text-zinc-200"}`} />
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 mt-1">
                    <span>👤 {item.studentName} {item.studentEmail ? `(${item.studentEmail})` : ""}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded uppercase font-bold text-[9px] tracking-wider">{item.messId}</span>
                    <span className="text-[10px] text-zinc-400 ml-auto">
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Recent"}
                    </span>
                  </div>

                  {item.comment && (
                    <p className={`text-xs italic p-2.5 rounded-xl mt-2 border ${isSolved ? "bg-zinc-50 text-zinc-400 line-through border-zinc-200" : "bg-[#fbf7f2] text-foreground border-border/60"}`}>
                      "{item.comment}"
                    </p>
                  )}

                  <div className="pt-2 flex justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Resolved &amp; Solved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required (Pending)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SuperAdminComplaintsViewer({ complaints }: { complaints: any[] }) {
  const [filter, setFilter] = useState<"all" | "unsolved" | "solved">("all");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("all");

  const filtered = complaints.filter((c) => {
    const isSolved = c.status === "solved";
    if (filter === "unsolved" && isSolved) return false;
    if (filter === "solved" && !isSolved) return false;

    if (timeRange === "all") return true;
    const cDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
    const now = new Date();

    if (timeRange === "day") return cDate.toDateString() === now.toDateString();
    if (timeRange === "week") {
      const ago = new Date();
      ago.setDate(now.getDate() - 7);
      return cDate >= ago;
    }
    if (timeRange === "month") return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
    return true;
  });

  async function handleToggleComplaintStatus(complaint: any) {
    if (!complaint.id || !db) return;
    const isSolved = complaint.status === "solved";
    const newStatus = isSolved ? "unsolved" : "solved";

    try {
      await updateDoc(doc(db, "complaints", complaint.id), { status: newStatus });
      await logSuperAdminActivity(
        complaint.messId || "all",
        "Complaint Status Update",
        `Marked complaint from ${complaint.studentName || "Student"} as ${newStatus}`
      );
    } catch (err) {
      console.error("Error updating complaint status:", err);
      alert("Failed to update complaint resolution status.");
    }
  }

  async function handleDeleteComplaint(complaint: any) {
    if (!complaint.id || !db) return;
    if (!confirm(`Permanently delete complaint from ${complaint.studentName || "Student"}?`)) return;

    try {
      await deleteDoc(doc(db, "complaints", complaint.id));
      await logSuperAdminActivity(
        complaint.messId || "all",
        "Complaint Deleted",
        `Removed complaint report from ${complaint.studentName || "Student"}`
      );
    } catch (err) {
      console.error("Error deleting complaint:", err);
      alert("Failed to delete complaint record.");
    }
  }

  function exportComplaintsToExcel() {
    if (filtered.length === 0) {
      alert("No complaint records available for this timeframe.");
      return;
    }

    const exportRows = filtered.map((c) => ({
      "Date / Time": c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString("en-IN") : "Recent",
      "Student Name": sanitizeExcelCell(c.studentName || "Anonymous"),
      "Mess Facility": sanitizeExcelCell(c.messId || "N/A"),
      "Category": sanitizeExcelCell(c.category || "General"),
      "Message / Issue": sanitizeExcelCell(c.message || c.issue_or_feedback || ""),
      "Resolution Status": c.status === "solved" ? "Resolved" : "Pending"
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CampusComplaints");
    XLSX.writeFile(wb, `MessHub_Complaints_${timeRange}_${new Date().toISOString().split("T")[0]}.xlsx`);
    logSuperAdminActivity("all", "Export Complaints", "Super Admin exported complaints to Excel");
  }

  return (
    <div className="bg-white border border-border rounded-3xl p-5 shadow-card space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-border w-fit">
            {(["all", "unsolved", "solved"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                  filter === type ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-border w-fit">
            {(["day", "week", "month", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
                  timeRange === t ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "day" ? "Today" : t === "week" ? "Past Week" : t === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={exportComplaintsToExcel}
          className="text-xs font-bold text-slate-700 bg-background hover:bg-slate-100 border border-border px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs self-start lg:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" /> Export Filtered Complaints
        </button>
      </div>

      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-xs italic text-muted-foreground">No complaint records found matching timeframe &amp; filter.</p>
        ) : (
          filtered.map((item) => {
            const isSolved = item.status === "solved";
            return (
              <div 
                key={item.id} 
                className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                  isSolved ? "bg-emerald-50/40 border-emerald-300 opacity-70" : "bg-white border-border shadow-xs"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleComplaintStatus(item)}
                  className="mt-1 shrink-0 text-primary hover:scale-110 transition cursor-pointer"
                  title={isSolved ? "Mark Unsolved" : "Mark Solved"}
                >
                  {isSolved ? <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" /> : <Square className="w-5 h-5 text-zinc-400" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-bold text-sm truncate ${isSolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.category || "Report / Issue"} <span className="uppercase text-[10px] text-muted-foreground ml-1 font-semibold">({item.messId || "General"})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteComplaint(item)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete complaint report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 mt-1">
                    <span>👤 {item.studentName || "Anonymous"} {item.email ? `(${item.email})` : ""}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300" />
                    <span className="text-[10px] text-zinc-400 ml-auto">
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Recent"}
                    </span>
                  </div>

                  {(item.message || item.issue_or_feedback) && (
                    <p className={`text-xs italic p-2.5 rounded-xl mt-2 border ${isSolved ? "bg-zinc-50 text-zinc-400 line-through border-zinc-200" : "bg-[#fbf7f2] text-foreground border-border/60"}`}>
                      "{item.message || item.issue_or_feedback}"
                    </p>
                  )}

                  <div className="pt-2 flex justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Resolved &amp; Solved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required (Pending)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}