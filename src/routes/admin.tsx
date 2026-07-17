import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  type DayMenu,
  type MealKey,
  type MessId,
  type Overrides,
  type WeeklyMenu,
} from "@/lib/messhub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Mess admin dashboard — MessHub" },
      { name: "description", content: "Manage the weekly menu, special date overrides, broadcasts and complaints." },
    ],
  }),
  component: AdminDashboard,
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AdminDashboard() {
  const [messId, setMessId] = useState<MessId>("crcl");
  const [weekly, setWeekly] = useState<WeeklyMenu>(() => getWeeklyMenu("crcl"));
  const [overrides, setOverrides] = useState<Overrides>(() => getOverrides("crcl"));
  const [activeDay, setActiveDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d;
  });
  const [showOverrideEditor, setShowOverrideEditor] = useState<string | null>(null);

  function switchMess(id: MessId) {
    setMessId(id);
    setWeekly(getWeeklyMenu(id));
    setOverrides(getOverrides(id));
  }

  const mess = MESSES.find((m) => m.id === messId)!;
  const dayMenu = weekly[activeDay] ?? DEFAULT_WEEKLY[activeDay];

  function updateDayMealItems(meal: MealKey, text: string) {
    const items = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const nextDay: DayMenu = { ...dayMenu, [meal]: items };
    const nextWeekly = { ...weekly, [activeDay]: nextDay };
    setWeekly(nextWeekly);
    saveWeeklyMenu(messId, nextWeekly);
  }

  const overrideKeys = useMemo(
    () => Object.keys(overrides).sort(),
    [overrides],
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="safe-top border-b border-border bg-card/60 px-5 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Mess admin · {mess.name}{mess.subtitle ? ` (${mess.subtitle})` : ""}
            </p>
            <h1 className="truncate text-xl font-bold">Weekly menu &amp; overrides</h1>
          </div>
          <Link to="/" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-card">
            View student app
          </Link>
        </div>

        <div className="mx-auto mt-3 flex max-w-5xl gap-2 overflow-x-auto pb-1">
          {MESSES.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMess(m.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                messId === m.id
                  ? "border-transparent gradient-warm text-white shadow-card"
                  : "border-border bg-card"
              }`}
            >
              {m.name}{m.subtitle ? ` (${m.subtitle})` : ""}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Enrolled" value="412" />
          <Stat label="Attended lunch" value="~318" hint="≈ 77%" />
          <Stat label="Avg rating" value="4.3" hint="Last 7 days" />
          <Stat label="Open complaints" value="3" />
        </div>

        {/* Weekly menu editor */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Weekly menu</h2>
              <p className="text-sm text-muted-foreground">Set it once — it repeats every week.</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.i}
                onClick={() => setActiveDay(d.i)}
                className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  activeDay === d.i
                    ? "border-transparent gradient-warm text-white shadow-card"
                    : "border-border bg-card"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MEAL_DEFS.map((m) => (
              <div key={m.key} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{m.icon}</span>
                    <span>{m.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(m.startH, m.startM)} – {formatTime(m.endH, m.endM)}
                  </span>
                </div>
                <textarea
                  value={(dayMenu[m.key] ?? []).join("\n")}
                  onChange={(e) => updateDayMealItems(m.key, e.target.value)}
                  rows={6}
                  placeholder="One item per line"
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(dayMenu[m.key] ?? []).length} item(s) · autosaves
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Special date overrides */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Special date overrides</h2>
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
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                No special overrides. The weekly menu is used for every date.
              </div>
            )}
            {overrideKeys.map((k) => {
              const o = overrides[k];
              const date = new Date(k + "T00:00:00");
              return (
                <div key={k} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                      </div>
                      <div className="text-xs text-muted-foreground">✨ {o.label}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOverrideEditor(k)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium"
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
                        className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive"
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

        {/* Broadcast + complaints (unchanged stubs) */}
        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-bold">Broadcast an announcement</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sent to every student in your mess.</p>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="e.g. Dinner will be delayed by 15 minutes today."
              className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <button className="mt-3 rounded-xl gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-card">
              Send broadcast
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="font-bold">Recent complaints</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">Food quality</div>
                  <div className="text-muted-foreground">Dal was too salty at lunch.</div>
                </div>
                <span className="text-xs text-muted-foreground">2h</span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">Hygiene</div>
                  <div className="text-muted-foreground">Requesting cleaner trays near counter 2.</div>
                </div>
                <span className="text-xs text-muted-foreground">5h</span>
              </li>
            </ul>
          </div>
        </section>

        <div className="mt-10 text-center">
          <Link to="/super-admin" className="text-sm text-muted-foreground underline">Go to super admin →</Link>
        </div>
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

function OverrideEditor({
  initialKey,
  existing,
  weeklyFallback,
  onCancel,
  onSave,
}: {
  initialKey: string;
  existing?: { label: string; menu: DayMenu };
  weeklyFallback: WeeklyMenu;
  onCancel: () => void;
  onSave: (k: string, v: { label: string; menu: DayMenu }) => void;
}) {
  const [dateStr, setDateStr] = useState(initialKey);
  const [label, setLabel] = useState(existing?.label ?? "Special menu");
  const initialMenu: DayMenu =
    existing?.menu ??
    weeklyFallback[new Date(initialKey + "T00:00:00").getDay()] ??
    DEFAULT_WEEKLY[0];
  const [menu, setMenu] = useState<DayMenu>(initialMenu);

  function setItems(meal: MealKey, text: string) {
    setMenu({ ...menu, [meal]: text.split("\n").map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-6 shadow-elevated sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{existing ? "Edit override" : "Add special date"}</h3>
          <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg" aria-label="Close">×</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Label (e.g. Independence Day)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 60))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MEAL_DEFS.map((m) => (
            <div key={m.key} className="rounded-2xl border border-border bg-background p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </div>
              <textarea
                rows={5}
                value={menu[m.key].join("\n")}
                onChange={(e) => setItems(m.key, e.target.value)}
                placeholder="One item per line"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!dateStr || !label.trim()) return;
              onSave(dateStr, { label: label.trim(), menu });
            }}
            className="rounded-xl gradient-warm px-4 py-2 text-sm font-semibold text-white shadow-card"
          >
            Save override
          </button>
        </div>
      </div>
    </div>
  );
}
