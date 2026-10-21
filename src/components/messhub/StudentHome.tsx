import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { DishFeedbackSchema, checkRateLimit, countFeedbackCommentWords, MIN_FEEDBACK_COMMENT_WORDS } from "@/lib/security";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { z } from "zod";
import {
  MEAL_DEFS,
  clearProfile,
  countdownTo,
  currentAndNextMeal,
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
import { Star, Sparkles, ChevronDown, ChevronUp, Download } from "lucide-react";
import { NavratriStudentWidget } from "@/components/messhub/NavratriSpecial";
import { MessCountdownTimer } from "@/components/ui/MessCountdownTimer"; // 🌟 Imported the creative timer component

const CATEGORIES = ["Food quality", "Hygiene", "Timing", "Staff behavior", "Other"] as const;

const complaintSchema = z.object({
  category: z.enum(CATEGORIES),
  message: z.string().trim().min(10, "Please describe the issue (min 10 chars)").max(3000),
});

export function StudentHome({ profile, onSignOut }: { profile: StudentProfile; onSignOut: () => void }) {
  const [now, setNow] = useState(() => new Date());

  // 📱 PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

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

      snapshot.forEach((docItem) => {
        const data = docItem.data() as SpecialOverride;
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
            // Older nutritionist-published weekly menus use this document ID.
            // Keep it as a fallback while the app migrates to the standard `{messId}_{day}` format.
            const alternateWeeklyDocRef = doc(firestoreDb, "mess_menus", `${profile.messId}_day_${activeWeekday}`);
            const alternateWeeklySnap = await getDoc(alternateWeeklyDocRef);
            setDailyMenu(alternateWeeklySnap.exists() ? alternateWeeklySnap.data() : null);
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

  // Complaint / Issue form state variables
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Food quality");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [complaintError, setComplaintError] = useState<string | null>(null);
  const [complaintSent, setComplaintSent] = useState(false);

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

    const lastNotifiedKey = sessionStorage.getItem("vitmess.last_notified_meal");

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

      sessionStorage.setItem("vitmess.last_notified_meal", focus.key);
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
        .map(docItem => ({
          id: docItem.id,
          messId: docItem.data().messId,
          title: docItem.data().title,
          body: docItem.data().body
        }))
        .filter(b => b.messId === profile.messId || b.messId === "all");

      setBroadcasts(list);
    });

    return () => broadcastUnsubscribe();
  }, [profile.messId]);

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setComplaintError(null);

    const parsed = complaintSchema.safeParse({ category, message: feedbackMessage });
    if (!parsed.success) {
      setComplaintError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmittingFeedback(true);
    
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5ixNijfyjthVlHvDQ9qSsEHsoDmo37PU6Q0hU69Dy_Mn2g4zOn3OheVBKdBs9p_w8/exec";

    const formData = new URLSearchParams();
    formData.append("secretKey", "mhub_sec_9f83a21b47c0e812d4a57891");
    formData.append("name", profile.name || "VIT Student");
    formData.append("email", profile.email || "N/A");
    formData.append("mess", messLabelStr);
    formData.append("messId", profile.messId);
    formData.append("type", "complaint");
    formData.append("rating", "-");
    formData.append("message", `[Complaint - ${category.toUpperCase()}] ${feedbackMessage.trim()}`);

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      setComplaintSent(true);
      setFeedbackMessage("");
      setTimeout(() => {
        setComplaintSent(false);
      }, 4000);
    } catch (err) {
      console.error("Failed to submit complaint:", err);
      setComplaintError("Failed to send complaint. Please check your network connection.");
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
            className="text-[#007F86] font-bold underline hover:opacity-80 transition break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }

  return (
    <div className="min-h-screen bg-[#E9F7F4] pb-28 font-sans select-none relative text-[#193A40]">
      
      {/* Header */}
      <header className="safe-top px-5 pt-4 pb-4 bg-[#FFFFFF] border-b border-[#B5DED4]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-[#193A40]/70 font-semibold">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 className="truncate text-2xl font-black text-[#193A40]">
              {greetingFor(now)}, {profile.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-sm font-medium text-[#193A40]/80">{messLabelStr}</p>
          </div>
          <button
            onClick={() => {
              if (confirm("Sign out of VITMESS?")) {
                clearProfile();
                onSignOut();
              }
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[#B5DED4] bg-[#E9F7F4] text-sm font-bold text-[#007F86] shadow-sm cursor-pointer"
            aria-label="Sign out"
          >
            {profile.name.charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* Hero: Creative Dynamic Countdown Timer Component */}
      <section className="px-5 mt-4">
        <MessCountdownTimer focus={focus} focusIsLive={focusIsLive} countdown={countdown} />

        {/* Overview Item List Card Layout */}
        <div className="mt-4 rounded-2xl border-2 border-[#B5DED4] bg-[#FFFFFF] p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#B5DED4]/60">
            <div className="text-xs font-bold uppercase tracking-wider text-[#193A40]/70">
              Today's {focus.name.toLowerCase()} menu
            </div>
            <button
              onClick={() => setOpenMeal(focus.key)}
              className="group text-xs font-bold text-[#007F86] flex items-center gap-1 cursor-pointer hover:underline"
            >
              <span>View full schedule</span>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
            </button>
          </div>
          
          <ul className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#193A40]">
            {(currentMenu[focus.key] ?? []).map((i: any, idx: number) => {
              const name = typeof i === "object" ? i.name : i;
              return (
                <li key={idx} className="truncate font-medium flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#007F86]" />
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Navratri Special Widget */}
      <section className="mt-6 px-5">
        <NavratriStudentWidget profile={profile} />
      </section>

      {/* Today's Meals Grid */}
      <section className="mt-8">
        <div className="px-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-[#193A40]">Today's menu</h3>
            <p className="text-xs text-[#193A40]/70 font-medium">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          {activeOverride && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#193A40] bg-[#B5DED4] border border-[#007F86]/30 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#007F86]" /> {activeOverride.label}
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
                className="group flex flex-col justify-between rounded-2xl border-2 border-[#B5DED4] bg-[#FFFFFF] p-4 text-left shadow-sm transition hover:border-[#007F86] min-h-[140px] cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{m.icon}</span>
                    {isLive && (
                      <span className="rounded-full bg-[#007F86] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-bold text-sm text-[#193A40] truncate">{m.name}</div>
                  <div className="text-[11px] text-[#193A40]/70 font-medium">
                    {formatTime(m.startH, m.startM)} – {formatTime(m.endH, m.endM)}
                  </div>
                </div>

                <div className="mt-2 space-y-0.5 border-t border-[#B5DED4]/60 pt-1.5 w-full overflow-hidden">
                  {mealItems.length > 0 ? (
                    mealItems.slice(0, 2).map((item: any, idx: number) => {
                      const itemName = typeof item === "object" ? item.name : item;
                      return (
                        <div key={idx} className="text-[11px] text-[#193A40]/80 truncate block font-medium">
                          • {itemName}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] italic text-[#193A40]/50">No menu items</div>
                  )}
                  {mealItems.length > 2 && (
                    <div className="text-[9px] font-bold text-[#007F86] mt-0.5">
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
        <h3 className="text-lg font-black text-[#193A40]">From your mess</h3>
        <div className="mt-3 space-y-2.5">
          {broadcasts.length === 0 ? (
            <p className="text-sm italic text-[#193A40]/70 py-2">No announcements at this time.</p>
          ) : (
            broadcasts.map((b) => (
              <article key={b.id} className="rounded-2xl border-2 border-[#B5DED4] bg-[#FFFFFF] p-4 shadow-sm">
                <h4 className="font-bold text-[#193A40]">{b.title}</h4>
                <p className="mt-1 text-sm text-[#193A40]/80">
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

      {/* General Bug / Issue Feedback & Complaint Form */}
      <section className="mt-8 px-5">
        <div className="rounded-2xl border-2 border-[#B5DED4] bg-[#FFFFFF] p-5 shadow-sm w-full">
          <h3 className="font-black text-[#193A40] text-sm tracking-tight">Submit a Complaint / Report Issue</h3>
          <p className="text-[11px] text-[#193A40]/70 mt-0.5 font-medium">Only your mess admin sees this. Be respectful.</p>
          
          {complaintSent ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-lg text-white font-bold">✓</div>
              <h4 className="mt-2 text-sm font-bold text-emerald-900">Complaint received</h4>
              <p className="mt-0.5 text-xs text-emerald-700">Your mess admin has been notified.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="mt-4 space-y-3.5">
              <div>
                <span className="mb-2 block text-xs font-bold text-[#193A40]">Category</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-full border-2 px-3 py-1 text-xs transition cursor-pointer font-bold ${
                        category === c ? "border-[#007F86] bg-[#007F86] text-white" : "border-[#B5DED4] bg-[#E9F7F4] text-[#193A40]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-bold text-[#193A40]">What happened?</span>
                <textarea
                  rows={4}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value.slice(0, 3000))}
                  placeholder="Describe the issue (min 10 chars)…"
                  className="w-full resize-none rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/30 px-3 py-2.5 text-xs font-medium outline-none focus:border-[#007F86] transition text-[#193A40]"
                />
                <div className="mt-1 text-right text-[10px] text-[#193A40]/60">{feedbackMessage.length} / 3000</div>
              </div>

              {complaintError && (
                <div role="alert" className="rounded-xl bg-red-100 px-3 py-2 text-xs text-red-700 font-medium border border-red-200">
                  {complaintError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingFeedback || feedbackMessage.trim().length < 10}
                className="w-full rounded-xl bg-[#007F86] text-white px-3 py-2.5 text-xs font-bold active:scale-[0.99] transition disabled:opacity-40 cursor-pointer shadow-sm hover:opacity-90"
              >
                {isSubmittingFeedback ? "Sending..." : "Send complaint"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* PWA Install Permanent Banner */}
      <div className="my-6 px-5">
        <div className="rounded-2xl border-2 border-[#007F86]/30 bg-[#E9F7F4] p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#007F86] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#193A40]">Install VITMESS App</h4>
              <p className="text-[11px] text-[#193A40]/70">Add to home screen for offline support &amp; fast access.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === "accepted") {
                  setDeferredPrompt(null);
                }
              } else {
                alert("To install VITMESS, tap your browser's menu (...) or share icon and select 'Add to Home Screen'.");
              }
            }}
            className="bg-[#007F86] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition hover:opacity-90 cursor-pointer shrink-0"
          >
            Install App
          </button>
        </div>
      </div>

      {/* Professional Footer */}
      <footer className="mt-12 px-5 py-6 border-t border-[#B5DED4] text-center text-xs text-[#193A40]/70 space-y-1 font-medium">
        <p className="text-[11px]">
          &copy; {new Date().getFullYear()} VITMESS. All rights reserved.
        </p>
      </footer>

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
  const commentWordCount = countFeedbackCommentWords(comment);

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

    if (commentWordCount < MIN_FEEDBACK_COMMENT_WORDS) {
      alert(`⚠️ Please write at least ${MIN_FEEDBACK_COMMENT_WORDS} words explaining your rating.`);
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
          comment: comment.trim(),
          status: "unsolved",
        });

        if (validation.success) {
          await submitItemFeedback(validation.data);
        }
      }

      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5ixNijfyjthVlHvDQ9qSsEHsoDmo37PU6Q0hU69Dy_Mn2g4zOn3OheVBKdBs9p_w8/exec";

      const formData = new URLSearchParams();
      formData.append("secretKey", "mhub_sec_9f83a21b47c0e812d4a57891");
      formData.append("name", profile.name || "VIT Student");
      formData.append("email", profile.email || "N/A");
      formData.append("mess", profile.messId);
      formData.append("rating", String(rating || 5));
      formData.append(
        "message",
        `[Multiple Dish Feedback - ${selectedMeal.toUpperCase()}] Dishes: ${selectedDishes.join(", ")} | Rating: ${rating}/5 | Comment: ${comment.trim() || "None"}`
      );

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
    <div className="rounded-2xl border-2 border-[#B5DED4] bg-[#FFFFFF] p-5 shadow-sm w-full text-[#193A40]">
      <h3 className="font-black text-[#193A40] text-sm tracking-tight flex items-center gap-2">
        <span>🍲</span> Rate Today's Dishes (Multi-Select)
      </h3>
      <p className="text-[11px] text-[#193A40]/70 mt-0.5 font-medium">
        Select multiple items to flag good or bad items from today's spread.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid grid-cols-4 gap-1 bg-[#E9F7F4] p-1 rounded-xl border border-[#B5DED4]">
          {MEAL_DEFS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMeal(m.key)}
              className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                selectedMeal === m.key
                  ? "bg-[#007F86] text-white shadow-xs"
                  : "text-[#193A40]/70 hover:text-[#193A40]"
              }`}
            >
              {m.key}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase tracking-wider mb-1.5">
            Select Dishes (Check all that apply)
          </label>
          {availableItems.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#E9F7F4]/40 border-2 border-[#B5DED4] rounded-xl">
              {availableItems.map((dish: string, idx: number) => {
                const isChecked = selectedDishes.includes(dish);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDishSelection(dish)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isChecked ? "bg-[#007F86]/10 border-2 border-[#007F86] text-[#193A40]" : "bg-[#FFFFFF] border border-[#B5DED4] text-[#193A40]/80 hover:text-[#193A40]"
                    }`}
                  >
                    <span className="truncate">{dish}</span>
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold ${
                      isChecked ? "bg-[#007F86] border-[#007F86] text-white" : "border-[#193A40]/30 bg-[#FFFFFF]"
                    }`}>
                      {isChecked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-[#193A40]/60 py-1">No items listed for {selectedMeal} today.</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase tracking-wider mb-1">
            Overall Rating for Selected Items
          </label>
          <div className="flex items-center gap-1.5 bg-[#E9F7F4] p-2 rounded-xl border border-[#B5DED4] justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition active:scale-125 cursor-pointer"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating ? "fill-amber-500 text-amber-500" : "text-[#193A40]/25"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#193A40]/70 uppercase tracking-wider mb-1">
            Why did you give this rating? (minimum 5 words)
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. The roti was fresh but the dal was too salty."
            className="w-full resize-none rounded-xl border-2 border-[#B5DED4] bg-[#E9F7F4]/30 px-3 py-2 text-xs font-medium outline-none focus:border-[#007F86] transition text-[#193A40]"
          />
          <p className={`mt-1 text-right text-[10px] font-medium ${commentWordCount >= MIN_FEEDBACK_COMMENT_WORDS ? "text-emerald-700" : "text-[#193A40]/60"}`}>
            {commentWordCount} / {MIN_FEEDBACK_COMMENT_WORDS} words minimum
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedDishes.length === 0 || commentWordCount < MIN_FEEDBACK_COMMENT_WORDS}
          className="w-full rounded-xl bg-[#007F86] text-white py-2.5 text-xs font-bold shadow-md active:scale-[0.99] transition disabled:opacity-40 cursor-pointer hover:opacity-90"
        >
          {isSubmitting ? "Submitting Ratings..." : `Submit Feedback (${selectedDishes.length} selected)`}
        </button>
      </form>
    </div>
  );
}

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
      <div className="relative w-full max-w-md rounded-t-3xl bg-[#FFFFFF] p-6 pb-8 shadow-2xl safe-bottom max-h-[85vh] overflow-y-auto border-t-2 border-[#B5DED4]">
        <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-[#B5DED4]" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-3xl">{def.icon}</div>
            <h3 className="mt-1 text-2xl font-black text-[#193A40]">{def.name}</h3>
            <p className="text-sm font-medium text-[#193A40]/80">{formatTime(def.startH, def.startM)} – {formatTime(def.endH, def.endM)}</p>
            <p className="mt-0.5 text-xs text-[#193A40]/60">{date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#B5DED4] bg-[#E9F7F4] text-lg font-bold cursor-pointer text-[#193A40]">×</button>
        </div>

        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#193A40]/70">Menu Items & Nutrition</div>
          <ul className="mt-2 space-y-3">
            {items.length > 0 ? (
              items.map((item, idx) => {
                const isObject = typeof item === "object";
                const name = isObject ? item.name : item;
                const isExpanded = !!expandedDishes[idx];

                const activeMicronutrients = isObject && item.micronutrients ? Object.entries(item.micronutrients).filter(([_, val]) => typeof val === "number" && val > 0) : [];

                return (
                  <li key={idx} className="flex flex-col gap-2 rounded-2xl border-2 border-[#B5DED4] bg-[#E9F7F4]/30 p-3.5 text-sm text-[#193A40]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#007F86] shrink-0" />
                        <span className="text-[#193A40] font-bold">{name}</span>
                      </div>
                      
                      {isObject && (
                        <button
                          type="button"
                          onClick={() => toggleDishExpand(idx)}
                          className="text-[10px] font-bold text-[#007F86] flex items-center gap-1 bg-[#007F86]/10 px-2.5 py-1 rounded-xl cursor-pointer hover:bg-[#007F86]/20 transition border border-[#007F86]/30"
                        >
                          <span>{isExpanded ? "Less" : "Know More"}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {isObject && (() => {
                      const serving = item.servingSize || item.ServingSize;
                      const calories = Number(item.calories ?? item.Energy_kcal);
                      const protein = Number(item.protein ?? item.Protein_g);
                      const carbs = Number(item.carbs ?? item.Carbs_g);

                      const hasAnyBadge = Boolean(serving) || calories > 0 || protein > 0 || carbs > 0;
                      if (!hasAnyBadge) return null;

                      return (
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold pt-0.5 flex-wrap">
                          {serving && (
                            <span className="bg-white text-[#193A40] px-2.5 py-0.5 rounded-md border border-[#B5DED4]">
                              🍽️ {serving}
                            </span>
                          )}
                          {calories > 0 && (
                            <span className="bg-teal-50 text-teal-900 px-2.5 py-0.5 rounded-md border border-teal-200">
                              🔥 {calories} kcal
                            </span>
                          )}
                          {protein > 0 && (
                            <span className="bg-emerald-50 text-emerald-900 px-2.5 py-0.5 rounded-md border border-emerald-200">
                              💪 {protein}g Protein
                            </span>
                          )}
                          {carbs > 0 && (
                            <span className="bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-md border border-amber-200">
                              🌾 {carbs}g Carbs
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {isExpanded && isObject && (
                      <div className="mt-2 pt-3 border-t border-[#B5DED4] space-y-3 text-xs animate-fade-in bg-white p-3 rounded-xl border">
                        {(item.description || item.originStory || item.funFact || item.regionalTag) && (
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-[#007F86] flex items-center gap-1">
                              Cultural &amp; Food Profile
                            </span>
                            {item.regionalTag && <p className="text-[11px] font-semibold text-teal-800">🌍 {item.regionalTag}</p>}
                            {item.description && <p className="text-[11px] text-[#193A40]">{item.description}</p>}
                            {item.originStory && <p className="text-[11px] text-[#193A40]/70">🏛️ Roots: {item.originStory}</p>}
                            {item.funFact && <p className="text-[11px] text-[#193A40]/70 italic">💡 Trivia: {item.funFact}</p>}
                          </div>
                        )}

                        {activeMicronutrients.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-[#B5DED4]">
                            <span className="text-[9px] uppercase font-bold text-[#007F86]">
                              ✨ Micronutrients Breakdown
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {activeMicronutrients.map(([key, val]) => (
                                <span key={key} className="bg-[#E9F7F4] text-[#193A40] px-2 py-0.5 rounded-md text-[10px] font-bold border border-[#B5DED4]">
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
              <li className="text-sm text-[#193A40]/70 italic py-4 text-center">No items designated for this meal.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
