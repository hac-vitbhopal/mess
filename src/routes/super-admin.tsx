import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, onSnapshot } from "firebase/firestore";
import { 
  getAdminSession, 
  saveAdminSession, 
  clearAdminSession, 
  ADMIN_AUTH_KEYS, 
  mkEmptyDay 
} from "@/lib/messhub";

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
  const [session, setSession] = useState(() => getAdminSession());
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    // Redirect if a standard admin tries to breach the root console
    if (session && session.role !== "super-admin") {
      navigate({ to: "/admin" });
    }
  }, [session, navigate]);

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
  const [liveMesses, setLiveMesses] = useState<{ id: string; name: string; subtitle?: string }[]>([]);
  const [newMessId, setNewMessId] = useState("");
  const [newMessName, setNewMessName] = useState("");
  const [newMessSubtitle, setNewMessSubtitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // 📡 Real-time sync list mapping from active Firestore nodes
  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(collection(db, "messes"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any;
      setLiveMesses(list);
    });
    return () => unsubscribe();
  }, []);

  // 🏗️ Automated 7-Day Matrix Provisioning Generator Engine
  async function handleCreateNewMess(e: React.FormEvent) {
  e.preventDefault();
  const cleanId = newMessId.trim().toLowerCase().replace(/\s+/g, "_");
  const cleanName = newMessName.trim();
  const cleanSubtitle = newMessSubtitle.trim();

  if (!cleanId || !cleanName || !db) return;
  
  // 🔑 FIX: Capture the narrowed non-null instance in a local variable
  const firestore = db;
  setIsCreating(true);

  try {
    // Pass the local reference to the writeBatch builder
    const batch = writeBatch(firestore);

    // 1. Establish the main core mess metadata parameters document path
    const messDocRef = doc(firestore, "messes", cleanId);
    batch.set(messDocRef, {
      name: cleanName,
      ...(cleanSubtitle ? { subtitle: cleanSubtitle } : {}),
    });

    // 2. Automate creation of all 7 weekday structures populated with empty arrays
    const emptyDayData = mkEmptyDay(); 
    const weekdaysList = ["1", "2", "3", "4", "5", "6", "0"];

    weekdaysList.forEach((dayId) => {
      // 🔑 FIX: Use the local 'firestore' reference inside the callback closure
      const dayDocRef = doc(firestore, "messes", cleanId, "weeklyMenu", dayId);
      batch.set(dayDocRef, emptyDayData);
    });

    // Commit transaction up to cloud nodes concurrently
    await batch.commit();

    setNewMessId("");
    setNewMessName("");
    setNewMessSubtitle("");
    alert(`Registered ${cleanName} and fully generated all 7 empty weekday slots inside Firestore!`);
  } catch (error) {
    console.error("Batch initialization failure:", error);
    alert("Error setting up mess architecture nodes.");
  } finally {
    setIsCreating(false);
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
        {/* Creation Input Section */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-foreground tracking-tight">Register New Mess</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Initializes the mess channel and instantly sets up its Monday to Sunday database calendar nodes.
          </p>

          <form onSubmit={handleCreateNewMess} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Unique Mess ID (e.g., `crcl` or `mayuri_boys`):</label>
              <input
                required
                type="text"
                value={newMessId}
                onChange={(e) => setNewMessId(e.target.value)}
                placeholder="lowercase_id"
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Display Name (e.g., `CRCL` or `Mayuri`):</label>
              <input
                required
                type="text"
                value={newMessName}
                onChange={(e) => setNewMessName(e.target.value)}
                placeholder="Dining Facility Name"
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Subtitle / Section (Optional — e.g., `Girls`):</label>
              <input
                type="text"
                value={newMessSubtitle}
                onChange={(e) => setNewMessSubtitle(e.target.value)}
                placeholder="Leave blank if none"
                className="w-full rounded-xl border border-border bg-[#fbf7f2] px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating || !newMessId || !newMessName}
              className="mt-2 w-full rounded-xl bg-black py-2.5 text-xs font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-40"
            >
              {isCreating ? "Generating Architecture..." : "Deploy Mess Structure"}
            </button>
          </form>
        </div>

        {/* Real-time Streaming Overview Section */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-base font-bold text-foreground tracking-tight">
            Operational Dining Halls ({liveMesses.length})
          </h2>
          <div className="mt-4 space-y-2">
            {liveMesses.length === 0 ? (
              <p className="text-xs italic text-muted-foreground py-2">No custom cloud records detected.</p>
            ) : (
              liveMesses.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[#fbf7f2] border border-border/40">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-foreground truncate block">
                      {m.name} {m.subtitle && `(${m.subtitle})`}
                    </span>
                    <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">ID: {m.id}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md shrink-0">
                    7 Days Ready
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}