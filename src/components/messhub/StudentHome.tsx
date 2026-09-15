import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { StudentFeedbackSchema, DishFeedbackSchema, checkRateLimit } from "@/lib/security";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import {
  MEAL_DEFS,
  clearProfile,
  countdownTo,
  currentAndNextMeal,
  dateKey,
  formatTime,
  greetingFor,
  mealStatus,
  HARDCODED_WEEKLY_MENUS,
  trackBroadcastClick,
  logStudentOnboarding,
  submitItemFeedback,
  type MealKey,
  type StudentProfile,
  type SpecialOverride,
} from "@/lib/messhub";
import { Link } from "@tanstack/react-router";
import { Star, Clock, Sparkles, ChevronDown, ChevronUp, Flame, Dumbbell, Wheat, ChefHat, Info } from "lucide-react";

export function StudentHome({ profile, onSignOut }: { profile: StudentProfile; onSignOut: () => void }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (profile?.name && profile?.messId) {
      logStudentOnboarding(profile).catch((err) =>
        console.error("[StudentHome] Onboarding active ping error:", err)
      );
    }
  }, [profile]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [now]);

  const activeWeekday = new Date().getDay();
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  const [broadcasts, setBroadcasts] = useState<{ id: string; title: string; body: string }[]>([]);

  const [activeOverride, setActiveOverride] = useState<SpecialOverride | null>(null);
  const [dailyMenu, setDailyMenu] = useState<any>(null);

  useEffect(() => {
    if (!db || !profile?.messId) return;

    const q = query(
      collection(db, "mess_overrides"),
      where("messId", "==", profile.messId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let foundOverride: SpecialOverride | null = null;

      snapshot.forEach((doc) => {
        const data = doc.data() as SpecialOverride;
        if (data.date === todayDateStr) {
          const [startH, startM] = (data.startTime || "00:00").split(":").map(Number);
          const [endH, endM] = (data.endTime || "23:59").split(":").map(Number);

          const startDateTime = new Date();
          startDateTime.setHours(startH, startM, 0, 0);

          const endDateTime = new Date();
          endDateTime.setHours(endH, endM, 0, 0);

          if (now >= startDateTime && now <= endDateTime) {
            foundOverride = data;
          }
        }
      });

      setActiveOverride(foundOverride);
    });

    return () => unsub();
  }, [profile?.messId, todayDateStr, now]);

  useEffect(() => {
    if (!db || !profile?.messId || !todayDateStr) return;
    const firestoreDb = db;

    async function loadDailyMenuFromFirestore() {
      try {
        const dailyDocRef = doc(firestoreDb, "daily_menus", `${profile.messId}_${todayDateStr}`);
        const dailySnap = await getDoc(dailyDocRef);

        if (dailySnap.exists()) {
          setDailyMenu(dailySnap.data());
        } else {
          const weeklyDocRef = doc(firestoreDb, "mess_menus", `${profile.messId}_${activeWeekday}`);
          const weeklySnap = await getDoc(weeklyDocRef);

          if (weeklySnap.exists()) {
            setDailyMenu(weeklySnap.data());
          } else {
            setDailyMenu(null);
          }
        }
      } catch (err) {
        console.error("[StudentHome] Error loading daily menu:", err);
        setDailyMenu(null);
      }
    }

    loadDailyMenuFromFirestore();
  }, [profile?.messId, todayDateStr, activeWeekday]);

  const currentMenu = useMemo(() => {
    if (activeOverride && activeOverride.menu) {
      return activeOverride.menu; 
    }
    if (dailyMenu) return dailyMenu;
    return HARDCODED_WEEKLY_MENUS[profile.messId]?.[activeWeekday] || { breakfast: [], lunch: [], snacks: [], dinner: [] };
  }, [activeOverride, dailyMenu, profile.messId, activeWeekday]);

  useEffect(() => {
    async function syncToken() {
      if (!profile?.messId) return;
      try {
        const { subscribeToMessTopic } = await import("@/lib/firebase");
        await subscribeToMessTopic(profile.messId, profile.name);
      } catch (err) {
        console.error("[FCM] Token sync failed:", err);
      }
    }
    syncToken();
  }, [profile.messId, profile.name]);

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const messMeta: Record<string, { name: string; subtitle?: string }> = {
    jmb: { name: "JMB", subtitle: "Boys" },
    mayuri_boys: { name: "Mayuri", subtitle: "Boys" },
    mayuri_girls: { name: "Mayuri", subtitle: "Girls" },
    rassense: { name: "Rassense", subtitle: "" },
    food_sutra: { name: "Food Sutra", subtitle: "" },
    safal: { name: "Safal", subtitle: "" },
    anchor: { name: "Anchor", subtitle: "" },
    ab_catering: { name: "AB Catering", subtitle: "" }
  };
  
  const activeMess = messMeta[profile.messId] || { name: profile.messId.toUpperCase() };
  const messLabelStr = `${activeMess.name}${activeMess.subtitle ? ` (${activeMess.subtitle})` : ""} Mess`;

  const { current, next } = useMemo(() => currentAndNextMeal(now), [now]);
  const focus = current ?? next ?? MEAL_DEFS[0];
  const focusIsLive = current !== null;
  const countdown = focusIsLive
    ? countdownTo(focus.endH, focus.endM, now)
    : countdownTo(focus.startH, focus.startM, now);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const lastNotifiedKey = sessionStorage.getItem("messhub.last_notified_meal");

    if (focusIsLive && focus && lastNotifiedKey !== focus.key) {
      const items = currentMenu[focus.key] ?? [];
      const itemString = items
        .slice(0, 3)
        .map((i: any) => typeof i === "object" ? i.name : i)
        .join(", ") + (items.length > 3 ? "..." : "");

      const alertConfig = {
        title: `🍽️ ${focus.name} is Live!`,
        body: `Check out today's selections: ${itemString}`,
      };

      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(alertConfig.title, {
          body: alertConfig.body,
          icon: "/mess_logo.png",
          badge: "/mess_logo.png",
          tag: `meal-${focus.key}-${todayDateStr}`,
          renotify: true,
          requireInteraction: false,
          vibrate: [200, 100, 200],
          data: { url: "/" }
        } as any);
      });

      sessionStorage.setItem("messhub.last_notified_meal", focus.key);
    }
  }, [focus, focusIsLive, currentMenu, todayDateStr]);

  useEffect(() => {
    if (!db || !profile.messId) return;

    const broadcastQuery = query(
      collection(db, "broadcasts"),
      orderBy("createdAt", "desc")
    );
    
    const broadcastUnsubscribe = onSnapshot(broadcastQuery, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({
          id: doc.id,
          messId: doc.data().messId,
          title: doc.data().title,
          body: doc.data().body
        }))
        .filter(b => b.messId === profile.messId || b.messId === "all");

      setBroadcasts(list);
    });

    return () => broadcastUnsubscribe();
  }, [profile.messId]);

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setIsSubmittingFeedback(true);
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqJc_wS6XcWnqCjetwPtnTD-OMePvEu0NoI64EbEBxG1p2Jx5mL_iTtWgvx4MsKMb2/exec";

    const formData = new URLSearchParams();
    formData.append("name", profile.name || "VIT Student");
    formData.append("email", profile.email || "N/A");
    formData.append("mess", messLabelStr);
    formData.append("message", feedbackMessage.trim());

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      alert("Thank you! Your feedback has been recorded and sent to the administration.");
      setFeedbackMessage("");
    } catch (err) {
      console.error("Feedback submission error:", err);
      alert("Network error. Could not connect to the feedback server.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  function renderBroadcastBody(b: { id: string; title: string; body: string }) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = b.body.split(urlRegex);

    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBroadcastClick(b.id, b.title, part)}
            className="text-primary font-bold underline hover:opacity-80 transition break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }

  return (
    <div className="min-h-screen bg-background pb-28 font-sans select-none">
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
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-sm font-semibold shadow-card cursor-pointer"
            aria-label="Sign out"
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* Hero: current / next meal */}
      <section className="px-5">
        <div className="relative overflow-hidden rounded-3xl gradient-warm p-6 text-white shadow-elevated transition-all duration-300 hover:shadow-2xl">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          
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
              <h2 className="text-4xl font-black tracking-tight drop-shadow-sm">
                {focus.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-white/80 tracking-wide">
                {formatTime(focus.startH, focus.startM)} – {formatTime(focus.endH, focus.endM)}
              </p>
            </div>

            <div className="my-5 h-[1px] w-full bg-gradient-to-r from-white/20 via-white/10 to-transparent" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/15 rounded-2xl p-4 border border-white/5 backdrop-blur-xs">
              <div className="text-xs font-bold uppercase tracking-widest text-white/70">
                {focusIsLive ? "Time Remaining" : "Countdown to Service"}
              </div>
              <div className="font-display text-2xl font-black tracking-widest tabular-nums bg-white text-primary px-4 py-1.5 rounded-xl shadow-md">
                {String(countdown.hours).padStart(2, "0")}:
                {String(countdown.mins).padStart(2, "0")}:
                {String(countdown.secs).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* Overview Item List Card Layout */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Today's {focus.name.toLowerCase()} menu
            </div>
            <button
              onClick={() => setOpenMeal(focus.key)}
              className="group text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
            >
              <span>View full schedule</span>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
            </button>
          </div>
          
          <ul className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {(currentMenu[focus.key] ?? []).map((i: any, idx: number) => {
              const name = typeof i === "object" ? i.name : i;
              return (
                <li key={idx} className="truncate font-medium flex items-center gap-2 text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Today's Meals Grid */}
      <section className="mt-8">
        <div className="px-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Today's menu</h3>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          {activeOverride && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> {activeOverride.label}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 px-5">
          {MEAL_DEFS.map((m) => {
            const isLive = mealStatus(m, now) === "live";
            const mealItems = currentMenu[m.key] ?? [];
            
            return (
              <button
                key={m.key}
                onClick={() => setOpenMeal(m.key)}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-card transition hover:border-primary/40 min-h-[140px] cursor-pointer"
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
                    mealItems.slice(0, 2).map((item: any, idx: number) => {
                      const itemName = typeof item === "object" ? item.name : item;
                      return (
                        <div key={idx} className="text-[11px] text-muted-foreground truncate block">
                          • {itemName}
                        </div>
                      );
                    })
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
                <p className="mt-1 text-sm text-muted-foreground">
                  {renderBroadcastBody(b)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Daily Item-Level Dish Rating & Feedback Card */}
      <section className="mt-8 px-5">
        <DailyItemFeedbackCard profile={profile} currentMenu={currentMenu} />
      </section>

      {/* General Bug / Issue Feedback Form */}
      <section className="mt-8 px-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card w-full">
          <h3 className="font-bold text-foreground text-sm tracking-tight">Report an Issue or Feedback</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Noticed a menu glitch, layout bug, or want to suggest a feature? Let us know.</p>
          
          <form onSubmit={handleFeedbackSubmit} className="mt-3.5 space-y-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Reporter</span>
              <div className="text-xs font-semibold text-foreground mt-0.5 bg-muted/40 rounded-lg px-3 py-2 border border-border/40">
                {profile.name} <span className="opacity-50 font-normal">({activeMess.name})</span>
              </div>
            </div>
            
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Query / Description</span>
              <textarea
                rows={3}
                required
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe the bug, wrong menu item, or feedback request..."
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary transition"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmittingFeedback || !feedbackMessage.trim()}
              className="w-full rounded-xl bg-foreground text-background px-3 py-2.5 text-xs font-bold active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
            >
              {isSubmittingFeedback ? "Submitting Ticket..." : "Submit Response"}
            </button>
          </form>
        </div>
      </section>

      {/* Bottom sheet for meal items and nutrition badges */}
      {openMeal && (
        <MealSheet
          mealKey={openMeal}
          items={currentMenu[openMeal] ?? []}
          date={new Date()}
          onClose={() => setOpenMeal(null)}
        />
      )}
    </div>
  );
}

function DailyItemFeedbackCard({ profile, currentMenu }: { profile: StudentProfile; currentMenu: any }) {
  const [selectedMeal, setSelectedMeal] = useState<MealKey>("lunch");
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawItems = currentMenu[selectedMeal] || [];
  const availableItems = useMemo(() => {
    return rawItems.map((item: any) => (typeof item === "object" ? item.name : item));
  }, [rawItems]);

  useEffect(() => {
    setSelectedDishes([]);
  }, [selectedMeal]);

  const toggleDishSelection = (dish: string) => {
    setSelectedDishes((prev) =>
      prev.includes(dish) ? prev.filter((d) => d !== dish) : [...prev, dish]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDishes.length === 0) {
      alert("⚠️ Please select at least one dish to rate.");
      return;
    }

    if (!checkRateLimit("item_dish_rating", 5, 60000)) {
      alert("⚠️ Please wait a moment before submitting another rating.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const dish of selectedDishes) {
        const validation = DishFeedbackSchema.safeParse({
          studentName: profile.name,
          studentEmail: profile.email || "",
          messId: profile.messId,
          mealKey: selectedMeal,
          itemName: dish,
          rating,
          comment: comment ? `[${selectedMeal.toUpperCase()}] ${comment}` : `[${selectedMeal.toUpperCase()}] Rated ${rating}/5`,
          status: "unsolved",
        });

        if (validation.success) {
          await submitItemFeedback(validation.data);
        }
      }

      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqJc_wS6XcWnqCjetwPtnTD-OMePvEu0NoI64EbEBxG1p2Jx5mL_iTtWgvx4MsKMb2/exec";
      const formData = new URLSearchParams();
      formData.append("name", profile.name || "VIT Student");
      formData.append("email", profile.email || "N/A");
      formData.append("mess", profile.messId);
      formData.append("message", `[Multiple Dish Feedback - ${selectedMeal.toUpperCase()}] Dishes: ${selectedDishes.join(", ")} | Rating: ${rating}/5 | Comment: ${comment || "None"}`);

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      alert(`⭐ Thank you ${profile.name.split(" ")[0]}! Your feedback for ${selectedDishes.length} items has been logged.`);
      setSelectedDishes([]);
      setComment("");
      setRating(5);
    } catch (err) {
      console.error(err);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card w-full text-foreground">
      <h3 className="font-extrabold text-foreground text-sm tracking-tight flex items-center gap-2">
        <span>🍲</span> Rate Today's Dishes (Multi-Select)
      </h3>
      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
        Select multiple items to flag good or bad items from today's spread.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
          {MEAL_DEFS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMeal(m.key)}
              className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                selectedMeal === m.key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.key}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Select Dishes (Check all that apply)
          </label>
          {availableItems.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-background border border-border rounded-xl">
              {availableItems.map((dish: string, idx: number) => {
                const isChecked = selectedDishes.includes(dish);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDishSelection(dish)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isChecked ? "bg-primary/10 border border-primary text-foreground" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{dish}</span>
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold ${
                      isChecked ? "bg-primary border-primary text-white" : "border-muted-foreground/40 bg-background"
                    }`}>
                      {isChecked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground/70 py-1">No items listed for {selectedMeal} today.</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Overall Rating for Selected Items
          </label>
          <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded-xl border border-border/40 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition active:scale-125 cursor-pointer"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Specific Comments
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. These items were undercooked / too spicy..."
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary transition"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedDishes.length === 0}
          className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-xs font-bold shadow-md active:scale-[0.99] transition disabled:opacity-40 cursor-pointer"
        >
          {isSubmitting ? "Submitting Ratings..." : `Submit Feedback (${selectedDishes.length} selected)`}
        </button>
      </form>
    </div>
  );
}

// 🍲 UPDATED MEAL SHEET MODAL WITH DYNAMIC "KNOW MORE" DROPDOWN
function MealSheet({ mealKey, items, date, onClose }: { mealKey: MealKey; items: any[]; date: Date; onClose: () => void }) {
  const def = MEAL_DEFS.find((m) => m.key === mealKey)!;
  const [expandedDishes, setExpandedDishes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const toggleDishExpand = (idx: number) => {
    setExpandedDishes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-card p-6 pb-8 shadow-elevated safe-bottom max-h-[85vh] overflow-y-auto">
        <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-3xl">{def.icon}</div>
            <h3 className="mt-1 text-2xl font-bold">{def.name}</h3>
            <p className="text-sm text-muted-foreground">{formatTime(def.startH, def.startM)} – {formatTime(def.endH, def.endM)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-lg cursor-pointer">×</button>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu Items & Nutrition</div>
          <ul className="mt-2 space-y-3">
            {items.length > 0 ? (
              items.map((item, idx) => {
                const isObject = typeof item === "object";
                const name = isObject ? item.name : item;
                const isExpanded = !!expandedDishes[idx];

                // Filter micronutrients that have a value > 0
                const activeMicronutrients = isObject && item.micronutrients ? Object.entries(item.micronutrients).filter(([_, val]) => typeof val === "number" && val > 0) : [];

                return (
                  <li key={idx} className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3.5 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="text-foreground font-bold">{name}</span>
                      </div>
                      
                      {isObject && (
                        <button
                          type="button"
                          onClick={() => toggleDishExpand(idx)}
                          className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-xl cursor-pointer hover:bg-primary/20 transition"
                        >
                          <span>{isExpanded ? "Less" : "Know More"}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Primary 3 Macros Display (Energy, Protein, Carbs) + Serving Size */}
                    {isObject && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold pt-0.5 flex-wrap">
                        {item.servingSize && <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">🍽️ {item.servingSize}</span>}
                        {item.calories !== undefined && <span className="bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-md border border-orange-200">🔥 {item.calories} kcal</span>}
                        {item.protein !== undefined && <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md border border-emerald-200">💪 {item.protein}g Protein</span>}
                        {item.carbs !== undefined && <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-md border border-amber-200">🌾 {item.carbs}g Carbs</span>}
                      </div>
                    )}

                    {/* Expanded Know More Dropdown */}
                    {isExpanded && isObject && (
                      <div className="mt-2 pt-3 border-t border-border/80 space-y-3 text-xs animate-fade-in bg-card p-3 rounded-xl border">
                        
                        {/* Cultural Profile / Trivia */}
                        {(item.description || item.originStory || item.funFact || item.regionalTag) && (
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <Info className="w-3 h-3 text-primary" /> Cultural &amp; Food Profile
                            </span>
                            {item.regionalTag && <p className="text-[11px] font-semibold text-purple-700">🌍 {item.regionalTag}</p>}
                            {item.description && <p className="text-[11px] text-foreground">{item.description}</p>}
                            {item.originStory && <p className="text-[11px] text-muted-foreground">🏛️ Roots: {item.originStory}</p>}
                            {item.funFact && <p className="text-[11px] text-muted-foreground italic">💡 Trivia: {item.funFact}</p>}
                          </div>
                        )}

                        {/* Kitchen Recipe / Ingredients View
                        {item.recipe && (item.recipe.ingredients || item.recipe.method) && (
                          <div className="space-y-1 pt-2 border-t border-border/60">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              <ChefHat className="w-3 h-3 text-amber-600" /> Kitchen Preparation Specs
                            </span>
                            {item.recipe.ingredients && <p className="text-[11px] text-foreground"><strong>Ingredients:</strong> {item.recipe.ingredients}</p>}
                            {item.recipe.method && <p className="text-[11px] text-muted-foreground"><strong>Method:</strong> {item.recipe.method}</p>}
                          </div>
                        )} */}

                        {/* Filtered Active Micronutrients */}
                        {activeMicronutrients.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-border/60">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                              ✨ Micronutrients Breakdown
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {activeMicronutrients.map(([key, val]) => (
                                <span key={key} className="bg-muted text-foreground px-2 py-0.5 rounded-md text-[10px] font-bold border border-border">
                                  {key.replace(/([A-Z])/g, ' $1').toUpperCase()}: {String(val)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-muted-foreground italic py-4 text-center">No items designated for this meal.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}