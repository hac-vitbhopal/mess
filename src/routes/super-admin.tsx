import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { 
  getAdminSession, 
  saveAdminSession, 
  clearAdminSession, 
  ADMIN_AUTH_KEYS,
  MESSES,
  MEAL_DEFS,
  HARDCODED_WEEKLY_MENUS,
  type MealKey
} from "@/lib/messhub";
import { sendFcmNotification } from "@/lib/broadcast-action";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Master Control Gateway — MessHub" },
      { name: "description", content: "Platform super-admin infrastructure console." },
    ],
  }),
  component: SuperAdminGatekeeper,
});

function SuperAdminGatekeeper() {
  const navigate = useNavigate();
  
  // 1. Setup mounting guards to cleanly bypass server side rendering conflicts
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

  // Render a matching, neutral shell layout during server compilation passes
  if (!isMounted) {
    return <div className="min-h-screen bg-[#1c1c1e]" />;
  }

  if (!session || session.role !== "super-admin") {
    return (
      <div className="min-h-screen bg-[#1c1c1e] flex flex-col justify-between px-6 py-12 safe-top safe-bottom text-white select-none">
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

function PlatformMasterDashboard({ onSignOut }: { onSignOut: () => void }) {
  const currentWeekday = new Date().getDay();

  const [selectedMealKey, setSelectedMealKey] = useState<MealKey>("lunch");
  const [isFiringMealAlert, setIsFiringMealAlert] = useState(false);

  const [targetMessId, setTargetMessId] = useState<string>("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcastingCustom, setIsBroadcastingCustom] = useState(false);

  // 🔥 1. AUTOMATED MEAL TRIGGER FUNCTION (ALL MESSES BROADCAST)
  async function handleTriggerMealNotification() {
    if (!db) return;

    const selectedDef = MEAL_DEFS.find((m) => m.key === selectedMealKey);
    const mealName = selectedDef ? selectedDef.name : selectedMealKey;

    const confirmation = window.confirm(
      `🚨 ARE YOU SURE?\n\nThis will update the UI and send a live system notification to all student devices.`
    );
    if (!confirmation) return;

    setIsFiringMealAlert(true);
    try {
      const pushTemplates: Record<string, { title: string; bodyPrefix: string }> = {
        breakfast: { title: "🍳 Breakfast Counter Open!", bodyPrefix: "Today's fuel is served: " },
        lunch: { title: "🍽️ Lunch is Served!", bodyPrefix: "Smells amazing right now! On the line: " },
        snacks: { title: "☕ High Tea / Snacks Ready!", bodyPrefix: "Time for a quick study break! Grab some: " },
        "high-tea": { title: "☕ High Tea Ready!", bodyPrefix: "Time for a quick break! Grab some: " },
        dinner: { title: "🌙 Dinner Window Open!", bodyPrefix: "Ready to wrap up your day? Tonight's spread: " },
      };

      const template = pushTemplates[selectedMealKey] || { 
        title: `🍽️ ${mealName} is Live!`, 
        bodyPrefix: "Check out today's selections: " 
      };

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

        // ✅ FIXED: Replaced raw fetch with your type-safe TanStack server function call
        await sendFcmNotification({
          data: {
            topic: `mess_${mess.id}`,
            title: template.title,
            body: finalBodyText,
          }
        }).catch(err => console.error("FCM server function streaming error:", err));
      }

      alert(`🚀 Success! UI updated and background alerts dispatched!`);
    } catch (error) {
      console.error("Meal transmission failure:", error);
    } finally {
      setIsFiringMealAlert(false);
    }
  }

  // 📢 2. CUSTOM CHANNELS BROADCAST FUNCTION (ONE OR ALL MESSES)
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

      // ✅ FIXED: Replaced manual fetch here too for absolute system-wide coordination
      await sendFcmNotification({
        data: {
          topic: targetTopic,
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
        }
      });

      setBroadcastTitle("");
      setBroadcastBody("");
      alert(`⚡ Custom broadcast and native system push alert successfully deployed!`);
    } catch (error) {
      console.error("Custom broadcast failure:", error);
    } finally {
      setIsBroadcastingCustom(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf7f2]">
      <header className="safe-top border-b border-border bg-white/80 px-5 pb-4 pt-4 backdrop-blur sticky top-0 z-40 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Root Infrastructure</p>
          <h1 className="text-xl font-black tracking-tight text-foreground mt-0.5">Platform Console</h1>
        </div>
        <button 
          onClick={() => { clearAdminSession(); onSignOut(); }} 
          className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold shadow-card transition active:scale-95"
        >
          Exit Console
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 space-y-6">
        
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            <span>🚀</span> Automated Meal Alert Push
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selects a current meal period, builds custom interactive notifications featuring today's menu choices automatically, and triggers them across **ALL** campus app sessions.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Active Service Window:</label>
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

            <button
              type="button"
              onClick={handleTriggerMealNotification}
              disabled={isFiringMealAlert}
              className="mt-1 w-full rounded-xl gradient-warm py-3 text-xs font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-40"
            >
              {isFiringMealAlert ? "Syncing Menu Assets & Pushing..." : "Transmit Live Meal Alerts to All Devices"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            <span>📢</span> Custom Channel Broadcast
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Draft a completely custom announcement notice and deliver it dynamically to either a single specific targeted hall or a universal global blast.
          </p>

          <form onSubmit={handleDeployCustomBroadcast} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Channel Node Destination:</label>
              <select
                value={targetMessId}
                onChange={(e) => setTargetMessId(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition"
              >
                <option value="all">🌍 All Messes (Global Broadcast)</option>
                {MESSES.map((m) => (
                  <option key={m.id} value={m.id}>
                    🏢 {m.name} {m.subtitle ? `(${m.subtitle})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Broadcast Custom Heading:</label>
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
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Message Text Body Content:</label>
              <textarea
                required
                rows={3}
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
              className="mt-1 w-full rounded-xl bg-black py-2.5 text-xs font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-40"
            >
              {isBroadcastingCustom ? "Dispersing Packet Streams..." : "Disperse Custom Announcement"}
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}