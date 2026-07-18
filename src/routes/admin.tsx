import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  DEFAULT_WEEKLY,
  MEAL_DEFS,
  MESSES,
  dateKey,
  formatTime,
  getOverrides,
  getWeeklyMenu,
  saveOverrides,
  saveWeeklyMenu,
  getAdminSession,
  saveAdminSession,
  clearAdminSession,
  ADMIN_AUTH_KEYS,
  sendBroadcast,
  type DayMenu,
  type MealKey,
  type MessId,
  type Overrides,
  type WeeklyMenu,
} from "@/lib/messhub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Mess Control Gateway — MessHub" },
      { name: "description", content: "Secure authentication gateway for mess operators." },
    ],
  }),
  component: AdminGatekeeper,
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

function AdminGatekeeper() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getAdminSession());
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (session?.role === "super-admin") {
      navigate({ to: "/super-admin" });
    }
  }, [session, navigate]);

  function handleVerifyPasscode(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = passcode.trim();
    const matchedAuth = ADMIN_AUTH_KEYS[cleanKey];

    if (matchedAuth) {
      setAuthError(false);
      const newSession = { role: matchedAuth.role, messId: matchedAuth.messId };
      saveAdminSession(newSession);
      setSession(newSession);
      if (matchedAuth.role === "super-admin") {
        navigate({ to: "/super-admin" });
      }
    } else {
      setAuthError(true);
      setPasscode("");
      if ("vibrate" in navigator) navigator.vibrate(200);
    }
  }

  // Phase 1: Lockscreen Gate
  if (!session || !session.messId) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between px-6 py-12 safe-top safe-bottom select-none">
        <header className="flex items-center justify-between w-full max-w-sm mx-auto">
          <Link to="/" className="text-sm font-semibold text-muted-foreground transition active:opacity-60">
            &larr; Exit to App
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40">Gateway</span>
        </header>

        <main className="w-full max-w-sm mx-auto text-center flex-1 flex flex-col justify-center">
          <div className="h-12 w-12 rounded-2xl bg-card shadow-card mx-auto flex items-center justify-center border border-border/40">
            <span className="text-muted-foreground font-bold">Secure</span>
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-foreground">Enter Mess Access Key</h1>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-[240px] mx-auto">
            Input the security authorization key issued to your specific dining facility.
          </p>

          <form onSubmit={handleVerifyPasscode} className="mt-8">
            <input
              autoFocus
              type="password"
              value={passcode}
              onChange={(e) => { setAuthError(false); setPasscode(e.target.value); }}
              placeholder="••••••••"
              className={`w-full tracking-widest text-center rounded-2xl border bg-card px-4 py-4 text-lg font-bold outline-none transition-all ${
                authError 
                  ? "border-destructive ring-4 ring-destructive/10" 
                  : "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
              }`}
            />
            {authError && (
              <p className="mt-2.5 text-xs font-semibold text-destructive animate-fade-in">
                Invalid key code sequence. Try again.
              </p>
            )}
            <button
              type="submit"
              disabled={passcode.length === 0}
              className="mt-4 w-full rounded-2xl gradient-warm py-4 text-sm font-bold text-white shadow-card active:scale-[0.99] transition-all disabled:opacity-40"
            >
              Unlock Dashboard
            </button>
          </form>
        </main>

        <footer className="text-center text-[10px] text-muted-foreground/50 font-medium tracking-wide">
          MESSHUB SECURE MANAGEMENT INTERFACE
        </footer>
      </div>
    );
  }

  return <LockedMessDashboard messId={session.messId} onSignOut={() => setSession(null)} />;
}

/* ---------------- Concrete Isolated Dashboard View ---------------- */

function LockedMessDashboard({ messId, onSignOut }: { messId: MessId; onSignOut: () => void }) {
  const [weekly, setWeekly] = useState<WeeklyMenu>(() => getWeeklyMenu(messId));
  const [overrides, setOverrides] = useState<Overrides>(() => getOverrides(messId));
  const [activeDay, setActiveDay] = useState<number>(() => new Date().getDay());
  const [showOverrideEditor, setShowOverrideEditor] = useState<string | null>(null);
  
  // Local saving & broadcasting layout states
  const [isSaving, setIsSaving] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const mess = MESSES.find((m) => m.id === messId)!;
  const dayMenu = weekly[activeDay] ?? DEFAULT_WEEKLY[activeDay];

  // 📝 LOCAL ONLY STATE EDIT: Modifies menu in component state memory without writing to cloud instantly
  function updateDayMealItems(meal: MealKey, text: string) {
    const items = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const nextDay: DayMenu = { ...dayMenu, [meal]: items };
    const nextWeekly = { ...weekly, [activeDay]: nextDay };
    setWeekly(nextWeekly);
  }

  // 💾 EXPLICIT CLOUD PUBLISH TRIGGER: Overwrites database values only when button is pressed
  async function handleSaveChanges() {
    setIsSaving(true);
    try {
      await saveWeeklyMenu(messId, weekly);
      alert("Menu configuration updated and published to all student feeds!");
    } catch {
      alert("An error occurred while deploying updates. Check network stability.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendBroadcast() {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendBroadcast(messId, broadcastTitle.trim(), broadcastBody.trim());
      setBroadcastTitle("");
      setBroadcastBody("");
      alert("Announcement broadcasted successfully!");
    } catch {
      alert("Failed to deliver announcement. Please check your network.");
    } finally {
      setIsBroadcasting(false);
    }
  }

  const overrideKeys = useMemo(() => Object.keys(overrides).sort(), [overrides]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="safe-top border-b border-border bg-card/60 px-5 pb-4 pt-3 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Authorized Portal · {mess.name}{mess.subtitle ? ` (${mess.subtitle})` : ""}
            </p>
            <h1 className="truncate text-xl font-bold text-foreground">Weekly menu &amp; overrides</h1>
          </div>
          <button
            onClick={() => { clearAdminSession(); onSignOut(); }}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold shadow-card transition active:scale-95"
          >
            Lock Console
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {/* Weekly menu editor config */}
        <section className="mt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Weekly menu</h2>
              <p className="text-sm text-muted-foreground">Modify entries and click the save button below to publish changes.</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {WEEKDAYS.map((d) => (
              <button
                key={d.i}
                onClick={() => setActiveDay(d.i)}
                className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  activeDay === d.i
                    ? "border-transparent gradient-warm text-white shadow-card"
                    : "border-border bg-white text-muted-foreground"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {MEAL_DEFS.map((m) => (
              <div key={m.key} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span>{m.icon}</span>
                    <span>{m.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-md">
                    {formatTime(m.startH, m.startM)} – {formatTime(m.endH, m.endM)}
                  </span>
                </div>
                <textarea
                  value={(dayMenu[m.key] ?? []).join("\n")}
                  onChange={(e) => updateDayMealItems(m.key, e.target.value)}
                  rows={5}
                  placeholder="One item per separate line"
                  className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-medium transition"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(dayMenu[m.key] ?? []).length} item(s) typed · unpublished
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Global Save Action Trigger */}
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="mt-6 w-full rounded-2xl gradient-warm py-4 text-sm font-bold text-white shadow-card active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {isSaving ? "Publishing Updates..." : "Save & Update Student Portal"}
        </button>

        {/* Special date overrides */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Special date overrides</h2>
              <p className="text-sm text-muted-foreground">Festivals or one-off menus. Falls back to the weekly menu when no override exists.</p>
            </div>
            <button
              onClick={() => setShowOverrideEditor(dateKey(new Date()))}
              className="rounded-full gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-card"
            >
              + Add override
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {overrideKeys.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground font-medium">
                No special overrides. The weekly menu is used for every date.
              </div>
            )}
            {overrideKeys.map((k) => {
              const o = overrides[k];
              const date = new Date(k + "T00:00:00");
              return (
                <div key={k} className="rounded-2xl border border-border bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground">
                        {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                      </div>
                      <div className="text-xs text-primary font-semibold mt-0.5">Special: {o.label}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOverrideEditor(k)}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition active:bg-background"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm("Delete this override?")) return;
                          const next = { ...overrides };
                          delete next[k];
                          setOverrides(next);
                          saveOverrides(messId, next);
                        }}
                        className="rounded-full border border-destructive/40 bg-white px-3 py-1.5 text-xs font-medium text-destructive transition active:bg-destructive/5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Broadcast layout module */}
        <section className="mt-10">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card w-full">
            <h3 className="font-bold text-foreground text-base tracking-tight">Broadcast an announcement</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">This updates your students' notification feeds instantly.</p>
            
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Heading (e.g., Timing Extension)"
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary transition"
            />
            
            <textarea
              rows={3}
              maxLength={500}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Message text goes here..."
              className="mt-2.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary transition"
            />
            
            <button 
              onClick={handleSendBroadcast}
              disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastBody.trim()}
              className="mt-3 w-full rounded-xl gradient-warm px-4 py-2 text-xs font-bold text-white shadow-card active:scale-[0.99] transition disabled:opacity-40"
            >
              {isBroadcasting ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </section>
      </main>

      {showOverrideEditor && (
        <OverrideEditor
          initialKey={showOverrideEditor}
          existing={overrides[showOverrideEditor]}
          weeklyFallback={weekly}
          onCancel={() => setShowOverrideEditor(null)}
          onSave={(k, val) => {
            const next = { ...overrides, [k]: val };
            setOverrides(next);
            saveOverrides(messId, next);
            setShowOverrideEditor(null);
          }}
        />
      )}
    </div>
  );
}

function OverrideEditor({ initialKey, existing, weeklyFallback, onCancel, onSave }: {
  initialKey: string; existing?: { label: string; menu: DayMenu }; weeklyFallback: WeeklyMenu; onCancel: () => void; onSave: (k: string, v: { label: string; menu: DayMenu }) => void;
}) {
  const [dateStr, setDateStr] = useState(initialKey);
  const [label, setLabel] = useState(existing?.label ?? "Special menu");
  const initialMenu: DayMenu = existing?.menu ?? weeklyFallback[new Date(initialKey + "T00:00:00").getDay()] ?? DEFAULT_WEEKLY[0];
  const [menu, setMenu] = useState<DayMenu>(initialMenu);

  function setItems(meal: MealKey, text: string) {
    setMenu({ ...menu, [meal]: text.split("\n").map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-elevated sm:max-h-[85vh] sm:rounded-3xl border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{existing ? "Edit override" : "Add special date"}</h3>
          <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-lg" aria-label="Close">×</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Label (e.g. Festival Name)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 60))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MEAL_DEFS.map((m) => (
            <div key={m.key} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </div>
              <textarea
                rows={5}
                value={menu[m.key].join("\n")}
                onChange={(e) => setItems(m.key, e.target.value)}
                placeholder="One item per line"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary font-medium"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!dateStr || !label.trim()) return;
              onSave(dateStr, { label: label.trim(), menu });
            }}
            className="rounded-xl gradient-warm px-4 py-2 text-xs font-bold text-white shadow-card"
          >
            Save override
          </button>
        </div>
      </div>
    </div>
  );
}