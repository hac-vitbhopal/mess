import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { markFeedbackRead } from "@/lib/mark-feedback-read-action";
import type { StudentProfile } from "@/lib/messhub";

type Feedback = {
  id: string;
  itemName: string;
  mealKey: string;
  comment?: string;
  status: string;
  replyText?: string;
  repliedAt?: { toDate?: () => Date };
  replySeenByStudent?: boolean;
  createdAt?: { toMillis?: () => number };
};

/** A reply counts as read automatically this long after the mess sent it. */
const AUTO_READ_MS = 72 * 60 * 60 * 1000;

function repliedMillis(item: Feedback): number {
  return item.repliedAt?.toDate?.().getTime() ?? 0;
}

function isRead(item: Feedback): boolean {
  if (item.replySeenByStudent) return true;
  const sent = repliedMillis(item);
  return sent > 0 && Date.now() - sent >= AUTO_READ_MS;
}

export function MyFeedback({ profile }: { profile: StudentProfile }) {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") !== "my-feedback") return;
    window.setTimeout(() => document.getElementById("my-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, []);

  useEffect(() => {
    if (!db || !auth || !profile.email) return;
    const firestoreDb = db;
    const authService = auth;
    const studentEmail = profile.email.toLowerCase();
    let cancelled = false;
    let signedIn = false;
    // No orderBy here on purpose: ordering by createdAt needs a composite index, and without it the
    // whole list silently fails to load. We sort in the browser instead.
    const load = () =>
      getDocs(query(collection(firestoreDb, "item_feedback"), where("studentEmail", "==", studentEmail), limit(50)))
        .then((snap) => {
          if (cancelled) return;
          // Only feedback the mess has actually replied to is shown here.
          const list = snap.docs
            .map((entry) => ({ id: entry.id, ...entry.data() } as Feedback))
            .filter((item) => typeof item.replyText === "string" && item.replyText.trim() !== "");
          list.sort((a, b) => repliedMillis(b) - repliedMillis(a));
          setItems(list.slice(0, 20));
          setLoadError("");
          // Replies older than 72h are read automatically; save that so it sticks on every device.
          const expired = list.filter((item) => !item.replySeenByStudent && isRead(item)).map((item) => item.id);
          const user = authService.currentUser;
          if (expired.length > 0 && user?.email) {
            void user.getIdToken().then((idToken) => markFeedbackRead({ data: { idToken, feedbackIds: expired } })).catch(() => {});
          }
        })
        .catch((error: { code?: string }) => {
          console.error("[My feedback] load failed", error);
          if (cancelled) return;
          setLoadError(
            error?.code === "permission-denied"
              ? "Could not load your feedback. Please sign out and sign in again with your VIT Google account."
              : `Could not load your feedback (${error?.code || "unknown error"}).`,
          );
        });
    // Wait until Firebase has restored the sign-in before querying; asking too early looks like "permission denied".
    const stopAuthWatch = onAuthStateChanged(authService, (user) => {
      if (cancelled) return;
      if (user?.email) {
        signedIn = true;
        setLoadError("");
        void load();
      } else {
        signedIn = false;
        setItems([]);
        setLoadError(
          user
            ? "This browser is currently signed in with a staff account (admin or super admin). Open the student app in a private window, or sign in with your VIT Google account."
            : "Please sign in with your VIT Google account to see replies from your mess.",
        );
      }
    });
    // A reply can arrive while the app is open in the background; refresh when the student comes back.
    const onVisible = () => { if (document.visibilityState === "visible" && signedIn) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      stopAuthWatch();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [profile.email]);

  async function markRead(item: Feedback) {
    if (isRead(item)) return;
    setActionError("");
    const user = auth?.currentUser;
    if (!user?.email) {
      setActionError("Please sign in with your VIT Google account to mark replies as read.");
      return;
    }
    // Show it as read straight away; undo if the save is refused.
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, replySeenByStudent: true } : entry));
    try {
      await markFeedbackRead({ data: { idToken: await user.getIdToken(), feedbackIds: [item.id] } });
    } catch (error) {
      console.error("[My feedback] mark read failed", error);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, replySeenByStudent: false } : entry));
      setActionError(error instanceof Error && error.message ? error.message : "Could not mark as read. Please try again in a moment.");
    }
  }

  // Once a reply is read (by tapping, or automatically after 72h) it leaves this list.
  const unreadItems = items.filter((item) => !isRead(item));
  const unread = unreadItems.length;
  return <section id="my-feedback" className="mt-8 px-5 scroll-mt-4">
    <div className="rounded-2xl border-2 border-[#B5DED4] bg-white p-5 shadow-sm">
      <h2 className="text-base font-black">My feedback {unread > 0 && <span className="ml-1 rounded-full bg-[#007F86] px-2 py-0.5 text-[10px] text-white">{unread} new</span>}</h2>
      {loadError && <p className="mt-2 text-xs font-bold text-red-600">{loadError}</p>}
      {actionError && <p className="mt-2 text-xs font-bold text-red-600">{actionError}</p>}
      <div className="mt-3 space-y-2">
        {unreadItems.length === 0 ? <p className="text-xs text-[#193A40]/70">No new replies. When your mess replies to your feedback, it will appear here.</p> : unreadItems.map((item) => {
          return <article key={item.id} className="rounded-xl border border-[#B5DED4] p-3 text-xs">
            <p className="font-bold">{item.itemName} <span className="uppercase text-[#007F86]">({item.mealKey})</span></p>
            {item.comment && <p className="mt-1 text-[#193A40]/70">“{item.comment}”</p>}
            <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-[#E9F7F4] p-2">
              <div>
                <b>Mess reply:</b> {item.replyText}
                {item.repliedAt?.toDate && <span className="ml-1 text-[10px] text-[#193A40]/60">({item.repliedAt.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" })})</span>}
              </div>
              <button type="button" onClick={() => void markRead(item)} className="shrink-0 font-bold text-[#007F86] hover:underline">Mark as read</button>
            </div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
