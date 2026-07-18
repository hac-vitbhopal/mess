import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc } from "firebase/firestore";
import {
  MEAL_DEFS,
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
  
  // Real-time Cloud Firestore states
  const [broadcasts, setBroadcasts] = useState<{ id: string; title: string; body: string }[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState(() => resolveMenuForDate(profile.messId, today).menu);
  const [messMeta, setMessMeta] = useState<{ name: string; subtitle?: string } | null>(null);

  const messLabelStr = messMeta 
    ? `${messMeta.name}${messMeta.subtitle ? ` (${messMeta.subtitle})` : ""} Mess`
    : "Loading Mess Details...";

  const { current, next } = useMemo(() => currentAndNextMeal(now), [now]);
  const focus = current ?? next ?? MEAL_DEFS[0];
  const focusIsLive = current !== null;
  const countdown = focusIsLive
    ? countdownTo(focus.endH, focus.endM, now)
    : countdownTo(focus.startH, focus.startM, now);

  // 📡 REAL-TIME CLOUD LISTENER: Stream dynamic changes from Firestore database
  useEffect(() => {
    if (!db || !profile.messId) return;
    const firestore = db;

    // 1. Fetch Custom Mess Metadata fields created by Super Admin
    const metaUnsubscribe = onSnapshot(doc(firestore, "messes", profile.messId), (docSnap) => {
      if (docSnap.exists()) {
        setMessMeta(docSnap.data() as any);
      }
    });

    // 2. Listen to real-time menu updates specific to the selected day layout
    const activeWeekday = selectedDate.getDay();
    const menuUnsubscribe = onSnapshot(
      collection(firestore, "messes", profile.messId, "weeklyMenu"),
      (snapshot) => {
        snapshot.forEach((doc) => {
          if (Number(doc.id) === activeWeekday) {
            setWeeklyMenu(doc.data() as any);
          }
        });
      }
    );

    // 3. Listen to live announcements posted by your mess hall management
    const broadcastQuery = query(
      collection(firestore, "broadcasts"),
      where("messId", "==", profile.messId),
      orderBy("createdAt", "desc")
    );
    const broadcastUnsubscribe = onSnapshot(broadcastQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        body: doc.data().body
      }));
      setBroadcasts(list);
    });

    return () => {
      metaUnsubscribe();
      menuUnsubscribe();
      broadcastUnsubscribe();
    };
  }, [profile.messId, selectedDate]);

  const selectedResolved = useMemo(() => resolveMenuForDate(profile.messId, selectedDate), [profile.messId, selectedDate]);
  const strip = useMemo(() => buildDateStrip(today, 21), [today]);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-key="${dateKey(today)}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [today]);

// 📱 Inside your StudentHome component function, right above your return layout statement:
const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
const [showInstallBanner, setShowInstallBanner] = useState(false);

useEffect(() => {
  const handleBeforeInstallPrompt = (e: Event) => {
    // Prevent standard automatic browser prompt container layer from showing
    e.preventDefault();
    // Stash the event runner so it can be triggered seamlessly later
    setDeferredPrompt(e);
    // Alert state to render your custom install button panel layout
    setShowInstallBanner(true);
  };

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  return () => {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  };
}, []);

async function handleAppInstallation() {
  if (!deferredPrompt) return;
  
  // Show the native browser selection banner window overlay
  deferredPrompt.prompt();
  
  // Await user response criteria selection
  const { outcome } = await deferredPrompt.userChoice;
  console.info(`[PWA] Installation prompt resolution choice: ${outcome}`);
  
  // Clear parameters out of active runtime memory execution nodes
  setDeferredPrompt(null);
  setShowInstallBanner(false);
}


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
              {greetingFor(now)}, {profile.name.split(" ")[0]}
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
      {showInstallBanner && (
  <section className="px-5 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-card">
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-foreground">Add MessHub to Home Screen</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Access live dining selections instantly from your device home grid.</p>
      </div>
      <button 
        onClick={handleAppInstallation}
        className="shrink-0 rounded-xl gradient-warm px-4 py-2 text-xs font-bold text-white shadow-card active:scale-[0.98] transition"
      >
        Install App
      </button>
    </div>
  </section>
)}
      {/* Hero: current / next meal (today) */}
      <section className="px-5">
        <div className="relative overflow-hidden rounded-3xl gradient-warm p-6 text-white shadow-elevated transition-all duration-300 hover:shadow-2xl">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl transition-transform duration-500 hover:scale-110" />
          <div className="absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-white/5 blur-xl" />
          
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/90 bg-white/15 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
              {focusIsLive ? (
                <>
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-white" />
                  Serving Now
                </>
              ) : (
                <>Next Meal</>
              )}
            </div>

            <div className="mt-5 w-full">
              <h2 className="text-4xl font-black tracking-tight drop-shadow-sm select-none">
                {focus.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-white/80 tracking-wide">
                {formatTime(focus.startH, focus.startM)} – {formatTime(focus.endH, focus.endM)}
              </p>
            </div>

            <div className="my-5 h-[1px] w-full bg-gradient-to-r from-white/20 via-white/10 to-transparent" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/15 rounded-2xl p-4 border border-white/5 backdrop-blur-xs transition-colors duration-200 hover:bg-black/20">
              <div className="text-xs font-bold uppercase tracking-widest text-white/70">
                {focusIsLive ? "Time Remaining" : "Countdown to Service"}
              </div>
              <div className="font-display text-2xl font-black tracking-widest tabular-nums bg-white text-primary px-4 py-1.5 rounded-xl shadow-md select-none">
                {String(countdown.hours).padStart(2, "0")}:
                {String(countdown.mins).padStart(2, "0")}:
                {String(countdown.secs).padStart(2, "0")}
              </div>
            </div>

            {selectedResolved.source === "special" && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold tracking-wide backdrop-blur-sm border border-white/10">
                Special Menu: {selectedResolved.label}
              </div>
            )}
          </div>
        </div>

        {/* Overview Item List Card Layout */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:border-primary/20">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Today's {focus.name.toLowerCase()} menu
            </div>
            <button
              onClick={() => { setSelectedDate(today); setOpenMeal(focus.key); }}
              className="group text-xs font-bold text-primary flex items-center gap-1 transition-all duration-150 hover:gap-1.5 active:scale-95"
            >
              <span>View full schedule</span>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
            </button>
          </div>
          
          <ul className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {(weeklyMenu?.[focus.key] ?? []).map((i) => (
              <li key={i} className="truncate select-none font-medium flex items-center gap-2 transition-colors duration-150 hover:text-foreground">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{i}</span>
              </li>
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
          </div>
        </div>

        {/* Meal cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 px-5">
          {MEAL_DEFS.map((m) => {
            const isLive = dateKey(selectedDate) === dateKey(today) && mealStatus(m, now) === "live";
            const mealItems = selectedDate.getDay() === today.getDay() 
              ? (weeklyMenu?.[m.key] ?? []) 
              : (selectedResolved.menu?.[m.key] ?? []);
            
            return (
              <button
                key={m.key}
                onClick={() => setOpenMeal(m.key)}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-primary/40 min-h-[140px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{m.icon}</span>
                    {isLive && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-sm truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTime(m.startH, m.startM)} – {formatTime(m.endH, m.endM)}
                  </div>
                </div>

                <div className="mt-2 space-y-0.5 border-t border-border/60 pt-1.5 w-full overflow-hidden">
                  {mealItems.length > 0 ? (
                    mealItems.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="text-[11px] text-muted-foreground truncate block">
                        • {item}
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] italic text-muted-foreground/70">No menu items</div>
                  )}
                  {mealItems.length > 2 && (
                    <div className="text-[9px] font-medium text-primary mt-0.5">
                      +{mealItems.length - 2} more
                    </div>
                  )}
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
          {broadcasts.length === 0 ? (
            <p className="text-sm italic text-muted-foreground py-2">No announcements at this time.</p>
          ) : (
            broadcasts.map((b) => (
              <article key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <h4 className="font-semibold text-foreground">{b.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Bottom sheet */}
      {openMeal && (
        <MealSheet
          mealKey={openMeal}
          items={selectedDate.getDay() === today.getDay() ? (weeklyMenu?.[openMeal] ?? []) : (selectedResolved.menu?.[openMeal] ?? [])}
          date={selectedDate}
          specialLabel={selectedResolved.source === "special" ? selectedResolved.label : undefined}
          onClose={() => setOpenMeal(null)}
        />
      )}
    </div>
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
      <div className="relative w-full max-w-md rounded-t-3xl bg-card p-6 pb-8 shadow-elevated safe-bottom animate-in slide-in-from-bottom max-h-[80vh] overflow-y-auto">
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
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu Items</div>
          <ul className="mt-2 space-y-2">
            {items.length > 0 ? (
              items.map((i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm break-words">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-foreground font-medium">{i}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground italic py-4 text-center">No items designated for this meal.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}