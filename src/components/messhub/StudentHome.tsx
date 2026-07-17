import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MEAL_DEFS,
  MESSES,
  clearProfile,
  countdownTo,
  currentAndNextMeal,
  dateKey,
  formatTime,
  greetingFor,
  mealStatus,
  resolveMenuForDate,
  type MealKey,
  type StudentProfile,
} from "@/lib/messhub";

const BROADCASTS = [
  { id: 1, title: "Mess timings extended tonight", body: "Dinner service will run until 10:00 PM today for the fest.", when: "20 min ago" },
  { id: 2, title: "Feedback matters", body: "Please rate today's lunch — it helps us plan next week's menu.", when: "2 hr ago" },
];

function buildDateStrip(center: Date, days = 21): Date[] {
  const start = new Date(center);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.floor(days / 2));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function StudentHome({ profile, onSignOut }: { profile: StudentProfile; onSignOut: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);

  const mess = MESSES.find((m) => m.id === profile.messId)!;
  const messLabelStr = `${mess.name}${mess.subtitle ? ` (${mess.subtitle})` : ""} Mess`;

  const { current, next } = useMemo(() => currentAndNextMeal(now), [now]);
  const focus = current ?? next ?? MEAL_DEFS[0];
  const focusIsLive = current !== null;
  const countdown = focusIsLive
    ? countdownTo(focus.endH, focus.endM, now)
    : countdownTo(focus.startH, focus.startM, now);

  const todayResolved = useMemo(() => resolveMenuForDate(profile.messId, now), [profile.messId, now]);
  const selectedResolved = useMemo(() => resolveMenuForDate(profile.messId, selectedDate), [profile.messId, selectedDate]);

  const strip = useMemo(() => buildDateStrip(today, 21), [today]);
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll today into view on mount
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-key="${dateKey(today)}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [today]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="safe-top px-5 pt-2 pb-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 className="truncate text-2xl font-bold">
              {greetingFor(now)}, {profile.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{messLabelStr}</p>
          </div>
          <button
            onClick={() => {
              if (confirm("Sign out of MessHub?")) {
                clearProfile();
                onSignOut();
              }
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-sm font-semibold shadow-card"
            aria-label="Sign out"
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* Hero: current / next meal (today) */}
      <section className="px-5">
        <div className="relative overflow-hidden rounded-3xl gradient-warm p-6 text-white shadow-elevated">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/80">
              {focusIsLive ? (
                <>
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-white" />
                  Serving now
                </>
              ) : (
                <>Next meal</>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-4xl font-bold leading-none">
                  <span className="mr-2">{focus.icon}</span>
                  {focus.name}
                </h2>
                <p className="mt-2 text-sm text-white/85">
                  {formatTime(focus.startH, focus.startM)} – {formatTime(focus.endH, focus.endM)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/70">
                  {focusIsLive ? "Ends in" : "Starts in"}
                </div>
                <div className="font-display text-2xl font-bold tabular-nums">
                  {String(countdown.hours).padStart(2, "0")}:
                  {String(countdown.mins).padStart(2, "0")}:
                  {String(countdown.secs).padStart(2, "0")}
                </div>
              </div>
            </div>

            {todayResolved.source === "special" && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
                ✨ Special today · {todayResolved.label}
              </div>
            )}
          </div>
        </div>

        {/* items for hero meal (today) */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Today's {focus.name.toLowerCase()}</div>
            <button
              onClick={() => { setSelectedDate(today); setOpenMeal(focus.key); }}
              className="text-xs font-medium text-primary"
            >
              View all →
            </button>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {todayResolved.menu[focus.key].map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Horizontal calendar */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between px-5">
          <h3 className="text-lg font-bold">Browse menu</h3>
          <button
            onClick={() => setSelectedDate(today)}
            className="text-xs font-medium text-primary"
          >
            Today
          </button>
        </div>
        <div ref={stripRef} className="mt-3 flex gap-2 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {strip.map((d) => {
            const isSelected = dateKey(d) === dateKey(selectedDate);
            const isToday = dateKey(d) === dateKey(today);
            return (
              <button
                key={dateKey(d)}
                data-key={dateKey(d)}
                onClick={() => setSelectedDate(d)}
                className={`flex min-w-[56px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition ${
                  isSelected
                    ? "border-transparent gradient-warm text-white shadow-card"
                    : "border-border bg-card"
                }`}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="mt-0.5 font-display text-xl font-bold">{d.getDate()}</span>
                {isToday && (
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date label */}
        <div className="mt-3 px-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {selectedResolved.source === "special" ? "Special menu" : "Weekly menu"}
              </p>
              <p className="font-semibold">
                {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
            {selectedResolved.source === "special" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                ✨ {selectedResolved.label}
              </span>
            )}
          </div>
        </div>

        {/* Meal cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 px-5">
          {MEAL_DEFS.map((m) => {
            const isLive = dateKey(selectedDate) === dateKey(today) && mealStatus(m, now) === "live";
            return (
              <button
                key={m.key}
                onClick={() => setOpenMeal(m.key)}
                className="group rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{m.icon}</span>
                  {isLive && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Live
                    </span>
                  )}
                </div>
                <div className="mt-2 font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(m.startH, m.startM)} – {formatTime(m.endH, m.endM)}
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {selectedResolved.menu[m.key].slice(0, 3).join(" · ")}…
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Broadcasts */}
      <section className="mt-8 px-5">
        <h3 className="text-lg font-bold">From your mess</h3>
        <div className="mt-3 space-y-2.5">
          {BROADCASTS.map((b) => (
            <article key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold">{b.title}</h4>
                <span className="shrink-0 text-xs text-muted-foreground">{b.when}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom sheet */}
      {openMeal && (
        <MealSheet
          mealKey={openMeal}
          items={selectedResolved.menu[openMeal]}
          date={selectedDate}
          specialLabel={selectedResolved.source === "special" ? selectedResolved.label : undefined}
          onClose={() => setOpenMeal(null)}
        />
      )}

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 safe-bottom bg-card/90 backdrop-blur-xl border-t border-border">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
          <NavItem icon="🏠" label="Home" active />
          <Link to="/complaints" className="contents">
            <NavItem icon="💬" label="Complaints" />
          </Link>
          <Link to="/admin" className="contents">
            <NavItem icon="🛠️" label="Admin" />
          </Link>
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 transition ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function MealSheet({
  mealKey,
  items,
  date,
  specialLabel,
  onClose,
}: {
  mealKey: MealKey;
  items: string[];
  date: Date;
  specialLabel?: string;
  onClose: () => void;
}) {
  const def = MEAL_DEFS.find((m) => m.key === mealKey)!;
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-card p-6 pb-8 shadow-elevated safe-bottom animate-in slide-in-from-bottom">
        <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-3xl">{def.icon}</div>
            <h3 className="mt-1 text-2xl font-bold">{def.name}</h3>
            <p className="text-sm text-muted-foreground">
              {formatTime(def.startH, def.startM)} – {formatTime(def.endH, def.endM)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {specialLabel && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            ✨ {specialLabel}
          </div>
        )}

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's items</div>
          <ul className="mt-2 space-y-2">
            {items.map((i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
