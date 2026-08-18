import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy } from "firebase/firestore";
import { 
  getAdminSession, 
  saveAdminSession, 
  clearAdminSession, 
  ADMIN_AUTH_KEYS,
  MESSES,
  MEAL_DEFS,
  HARDCODED_WEEKLY_MENUS,
  deleteBroadcasts,
  toggleFeedbackStatus,
  type MealKey,
  type ItemFeedback
} from "@/lib/messhub";
import { sendFcmNotification } from "@/lib/broadcast-action";
import { 
  ShieldCheck, Users, Activity, MessageSquare, Megaphone, 
  LogOut, Menu, X, Clock, CheckSquare, Square, Star, 
  CheckCircle2, AlertCircle, Trash2, TrendingUp, Send, CheckCircle
} from "lucide-react";
import { AddMessAndMenuModal } from "@/components/messhub/AddMessAndMenuModal";
import { PlusCircle } from "lucide-react";
export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Master Control SaaS Dashboard — MessHub" },
      { name: "description", content: "Platform super-admin infrastructure console and analytics." },
    ],
  }),
  component: SuperAdminGatekeeper,
});

function SuperAdminGatekeeper() {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    setSession(getAdminSession());
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && session && session.role !== "super-admin") {
      navigate({ to: "/admin" });
    }
  }, [session, navigate, isMounted]);

  function handleVerifyPasscode(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = passcode.trim();
    const matchedAuth = ADMIN_AUTH_KEYS[cleanKey];

    if (matchedAuth && matchedAuth.role === "super-admin") {
      setAuthError(false);
      const newSession = { role: matchedAuth.role };
      saveAdminSession(newSession);
      setSession(newSession);
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
            <button type="submit" disabled={passcode.length === 0} className="mt-4 w-full rounded-2xl bg-white py-4 text-sm font-bold text-black active:scale-[0.99] transition-all disabled:opacity-40">
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
  const [activeTab, setActiveTab] = useState<"overview" | "feedbacks" | "broadcasts" | "students" | "analytics">("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [isAddMessModalOpen, setIsAddMessModalOpen] = useState(false);
  // Global Realtime Datasets
  const [students, setStudents] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<ItemFeedback[]>([]);
  const [menuLogs, setMenuLogs] = useState<any[]>([]);
  const [broadcastList, setBroadcastList] = useState<any[]>([]);
  const [clickLogs, setClickLogs] = useState<any[]>([]);

  // Local Action States
  const currentWeekday = new Date().getDay();
  const [selectedMealKey, setSelectedMealKey] = useState<MealKey>("lunch");
  const [isFiringMealAlert, setIsFiringMealAlert] = useState(false);
  const [targetMessId, setTargetMessId] = useState<string>("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcastingCustom, setIsBroadcastingCustom] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Live Firebase Sync Listeners
  useEffect(() => {
    if (!db) return;

    const unsubStudents = onSnapshot(collection(db, "registered_students"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.lastActiveAt?.toDate?.()?.getTime() || 0) - (a.lastActiveAt?.toDate?.()?.getTime() || 0));
      setStudents(list);
    });

    const unsubFeedbacks = onSnapshot(query(collection(db, "item_feedback"), orderBy("createdAt", "desc")), (snap) => {
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemFeedback)));
    });

    const unsubMenu = onSnapshot(query(collection(db, "mess_menus"), orderBy("updatedAt", "desc")), (snap) => {
      setMenuLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {}); // Fallback if composite index is pending

    const unsubBroadcasts = onSnapshot(query(collection(db, "broadcasts"), orderBy("createdAt", "desc")), (snap) => {
      setBroadcastList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubClicks = onSnapshot(query(collection(db, "broadcast_clicks")), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => (b.clickedAt?.toDate?.()?.getTime() || 0) - (a.clickedAt?.toDate?.()?.getTime() || 0));
      setClickLogs(logs);
    });

    return () => { unsubStudents(); unsubFeedbacks(); unsubMenu(); unsubBroadcasts(); unsubClicks(); };
  }, []);

  const pendingFeedbacksCount = feedbacks.filter(f => f.status === "unsolved").length;

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

    if (!window.confirm(`🚨 Transmit automated ${mealName} push alerts across all student endpoints?`)) return;

    setIsFiringMealAlert(true);
    try {
      const pushTemplates: Record<string, { title: string; bodyPrefix: string }> = {
        breakfast: { title: "🍳 Breakfast Counter Open!", bodyPrefix: "Today's fuel is served: " },
        lunch: { title: "🍽️ Lunch is Served!", bodyPrefix: "Smells amazing right now! On the line: " },
        snacks: { title: "☕ High Tea / Snacks Ready!", bodyPrefix: "Time for a quick study break! Grab some: " },
        dinner: { title: "🌙 Dinner Window Open!", bodyPrefix: "Ready to wrap up your day? Tonight's spread: " },
      };

      const template = pushTemplates[selectedMealKey] || { title: `🍽️ ${mealName} is Live!`, bodyPrefix: "Check out today's selections: " };

      for (const mess of MESSES) {
        const items = HARDCODED_WEEKLY_MENUS[mess.id]?.[currentWeekday]?.[selectedMealKey] ?? [];
        const itemString = items.slice(0, 3).join(", ") + (items.length > 3 ? "..." : "");
        const finalBodyText = `${template.bodyPrefix}${itemString || "Freshly cooked menu choices"}. Come down to the hall!`;

        await addDoc(collection(db, "broadcasts"), {
          messId: mess.id,
          title: template.title,
          body: finalBodyText,
          createdAt: serverTimestamp(),
        });

        await sendFcmNotification({
          data: { topic: `mess_${mess.id}`, title: template.title, body: finalBodyText }
        }).catch(() => {});
      }
      alert(`🚀 Success! UI updated and background alerts dispatched!`);
    } catch (error) {
      alert("Meal transmission failure.");
    } finally {
      setIsFiringMealAlert(false);
    }
  }

  async function handleDeployCustomBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim() || !db) return;

    setIsBroadcastingCustom(true);
    try {
      await addDoc(collection(db, "broadcasts"), {
        messId: targetMessId,
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        createdAt: serverTimestamp(),
      });

      const targetTopic = targetMessId === "all" ? "mess_all" : `mess_${targetMessId}`;
      const detectedUrlMatch = broadcastBody.match(/(https?:\/\/[^\s]+)/);
      const targetUrl = detectedUrlMatch ? detectedUrlMatch[0] : "/";

      await sendFcmNotification({
        data: { topic: targetTopic, title: broadcastTitle.trim(), body: broadcastBody.trim(), url: targetUrl }
      });

      setBroadcastTitle("");
      setBroadcastBody("");
      alert(`⚡ Custom broadcast successfully deployed!`);
    } catch (error) {
      alert("Custom broadcast failure.");
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
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-zinc-100 rounded-xl">
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
          <NavButton id="feedbacks" icon={MessageSquare} label="Campus Feedback" badge={pendingFeedbacksCount} />
          <NavButton id="broadcasts" icon={Megaphone} label="Broadcast Management" />
          <NavButton id="students" icon={Users} label="Student Directory" />
          <NavButton id="analytics" icon={TrendingUp} label="Click Analytics" />
        </div>

        <div className="p-4 border-t border-border">
          <button 
            onClick={() => { clearAdminSession(); onSignOut(); }} 
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
            <div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl sm:text-3xl font-black text-foreground">Infrastructure Overview</h1>
    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Real-time system telemetry and campus metrics.</p>
  </div>
  <button
    onClick={() => setIsAddMessModalOpen(true)}
    className="gradient-warm text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-card transition active:scale-95 cursor-pointer"
  >
    <PlusCircle className="w-4 h-4" /> Add New Mess &amp; Menu
  </button>
</div>
            
            {/* KPI METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Registered Students" value={students.length} icon={Users} color="bg-blue-50 text-blue-600" />
              <MetricCard title="Active Broadcasts" value={broadcastList.length} icon={Megaphone} color="bg-purple-50 text-purple-600" />
              <MetricCard title="Pending Feedback" value={pendingFeedbacksCount} icon={MessageSquare} color="bg-amber-50 text-amber-600" alert={pendingFeedbacksCount > 0} />
              <MetricCard title="Menu Audit Logs" value={menuLogs.length} icon={Activity} color="bg-emerald-50 text-emerald-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 🕒 LIVE MENU AUDIT LOG */}
              <div className="bg-white rounded-3xl border border-border p-5 shadow-card flex flex-col h-[460px]">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Live Menu Audit Trail
                  </h2>
                  <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">
                    Last 30 Updates
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

              {/* 🏢 MESH UTILIZATION DEMOGRAPHICS */}
              <div className="bg-white rounded-3xl border border-border p-5 shadow-card flex flex-col h-[460px]">
                <div className="pb-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Mess Facility Demographics
                  </h2>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                    100% Active Sync
                  </span>
                </div>
                <div className="mt-4 overflow-y-auto flex-1 space-y-4 pr-1">
                  {MESSES.map((mess) => {
                    const count = students.filter(s => s.messId === mess.id).length;
                    const percentage = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
                    return (
                      <div key={mess.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-foreground">
                          <span>{mess.name} {mess.subtitle ? `(${mess.subtitle})` : ""}</span>
                          <span className="text-muted-foreground">{count} Users ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden border border-zinc-200">
                          <div className="gradient-warm h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
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

        {/* ================= TAB 3: BROADCAST MANAGEMENT ================= */}
        {activeTab === "broadcasts" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Broadcast Management Console</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Deploy automated meal templates or custom alerts, and govern active notification feeds.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* AUTOMATED MEAL PUSH */}
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
                        className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-white transition"
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

              {/* CUSTOM BROADCAST FORM */}
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
                      className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition"
                    >
                      <option value="all">🌍 All Messes (Global Broadcast)</option>
                      {MESSES.map((m) => (
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

            {/* ACTIVE BROADCAST CONTROL TABLE */}
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

        {/* ================= TAB 4: STUDENT DIRECTORY ================= */}
        {activeTab === "students" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Student Onboarding Directory</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Comprehensive real-time directory of every student authenticated on MessHub.</p>
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

        {/* ================= TAB 5: CLICK ANALYTICS ================= */}
        {activeTab === "analytics" && (
          <div className="space-y-6 animate-fade-in pb-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Broadcast Link Click Analytics</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Real-time telemetry tracking student interactions with links embedded in broadcasts.</p>
            </div>

            <div className="bg-white rounded-3xl border border-border p-5 shadow-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>📊</span> Engagement Telemetry
                </h2>
                <span className="rounded-full bg-primary/10 text-primary font-bold px-3 py-1 text-xs">
                  Total Clicks: {clickLogs.length}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                {clickLogs.length === 0 ? (
                  <p className="py-12 text-center text-xs italic text-muted-foreground">No link clicks recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Mess</th>
                        <th className="py-3 px-4">Broadcast Title</th>
                        <th className="py-3 px-4">Link Clicked</th>
                        <th className="py-3 px-4 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {clickLogs.map((log) => (
                        <tr key={log.id} className="transition hover:bg-[#fbf7f2]">
                          <td className="py-3.5 px-4 font-bold text-foreground">{log.userName}</td>
                          <td className="py-3.5 px-4 font-bold uppercase text-[10px] text-red-500">{log.userMess}</td>
                          <td className="py-3.5 px-4 text-muted-foreground max-w-[150px] truncate">{log.broadcastTitle}</td>
                          <td className="py-3.5 px-4">
                            <a href={log.clickedUrl} target="_blank" rel="noreferrer" className="text-primary underline max-w-[200px] truncate block font-medium">
                              {log.clickedUrl}
                            </a>
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground text-[10px]">
                            {log.clickedAt?.toDate ? log.clickedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
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

      </main>
      {/* ⚡ 2. ADD THE MODAL COMPONENT HERE AT THE VERY BOTTOM */}
      <AddMessAndMenuModal 
        isOpen={isAddMessModalOpen} 
        onClose={() => setIsAddMessModalOpen(false)} 
      />
    </div>
  );
}

/* ---------------- 🧩 UI HELPER COMPONENTS ---------------- */

function MetricCard({ title, value, icon: Icon, color, alert }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-border shadow-card flex items-center justify-between relative overflow-hidden">
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

  const filtered = feedbacks.filter((f) => {
    if (filter === "unsolved") return f.status === "unsolved";
    if (filter === "solved") return f.status === "solved";
    return true;
  });

  return (
    <div className="bg-white border border-border rounded-3xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-xl border border-border w-fit">
        {(["all", "unsolved", "solved"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer ${
              filter === type ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-xs italic text-muted-foreground">No feedback entries found matching filter.</p>
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
                  onClick={() => item.id && toggleFeedbackStatus(item.id, item.status)}
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
                  </div>

                  {item.comment && (
                    <p className={`text-xs italic p-2.5 rounded-xl mt-2 border ${isSolved ? "bg-zinc-50 text-zinc-400 line-through border-zinc-200" : "bg-[#fbf7f2] text-foreground border-border/60"}`}>
                      "{item.comment}"
                    </p>
                  )}

                  <div className="pt-2 flex justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Resolved & Solved
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