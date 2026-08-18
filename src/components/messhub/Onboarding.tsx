import { useState } from "react";
import { MESSES, saveProfile, logStudentOnboarding, type MessId, type StudentProfile } from "@/lib/messhub";
import { requestNotificationPermission, subscribeToMessTopic, auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Onboarding({ onComplete }: { onComplete: (p: StudentProfile) => void }) {
  const [messId, setMessId] = useState<MessId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    if (!messId) {
      setError("Please select your assigned mess first");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!auth || !googleProvider) {
        throw new Error("Firebase Auth is not initialized");
      }

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || "";
      const name = user.displayName || "VIT Student";

      // ⚡ STRICT VIT BHOPAL DOMAIN VALIDATION
      if (!email.toLowerCase().endsWith("@vitbhopal.ac.in")) {
        await auth.signOut();
        setError("Please use your official @vitbhopal.ac.in email account.");
        setIsSubmitting(false);
        return;
      }

      const profile: StudentProfile = {
        name,
        email,
        messId,
      };

      // 1. Save locally
      saveProfile(profile);

      // 2. Await Firestore update for real-time tracking
      await logStudentOnboarding(profile);

      // 3. Save profile to registered_students collection for Super Admin view
      if (db) {
        await setDoc(doc(db, "registered_students", user.uid), {
          name,
          email,
          messId,
          lastActiveAt: serverTimestamp(),
        }, { merge: true });
      }

      // 4. Notification permissions & topic switch
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        await subscribeToMessTopic(profile.messId, profile.name);
      }

      onComplete(profile);
    } catch (err: any) {
      console.error("Setup error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google authentication failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100svh] w-full bg-[#FFF8F5] text-[#221510] flex flex-col justify-between items-center relative overflow-x-hidden font-sans select-none pb-4">
      
      {/* Background Soft Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-gradient-to-b from-[#FF7A00]/10 via-[#FF9E43]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container Envelope */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between relative z-10">
        
        {/* HEADER & LOGO WRAPPER BLOCK */}
        <div className="relative w-full">
          {/* Top Rich Orange Banner */}
          <div className="w-full bg-gradient-to-br from-[#FF6B2C] via-[#F97316] to-[#EA580C] pt-8 pb-14 px-6 rounded-b-[40px] text-center shadow-lg shadow-[#F97316]/15 relative overflow-hidden">
            
            {/* Ambient Shimmer Overlay */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Top Badges */}
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/25 text-white text-xs font-bold uppercase tracking-wider">
                <span>MessHub</span>
              </div>
              <span className="text-xs font-bold text-white bg-black/15 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                VIT Bhopal
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome Student
            </h1>
            <p className="text-xs sm:text-sm text-white/95 mt-0.5 max-w-xs mx-auto font-medium">
              Your campus dining companion.
            </p>
          </div>

          {/* EXACTLY ANCHORED LOGO BADGE */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 z-30 shrink-0">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-white p-1 shadow-md shadow-[#F97316]/20 border-4 border-[#FFF8F5] flex items-center justify-center overflow-hidden">
              <img
                src="/mess_logo.png"
                alt="MessHub Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </div>

        {/* FORM CONTENT SECTION */}
        <div className="px-5 sm:px-6 pt-12 pb-4 flex flex-col gap-4 w-full flex-1 justify-center">
          
          {/* Interactive Mess Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider">
                Select Your Mess
              </label>
              <span className="text-[10px] text-[#C2410C]/70 font-medium">Required for setup</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {MESSES.map((m) => {
                const active = messId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMessId(m.id)}
                    className={`p-2.5 rounded-2xl text-left transition-all duration-150 relative flex flex-col justify-between border-2 cursor-pointer active:scale-[0.98] ${
                      active
                        ? "bg-gradient-to-br from-[#FF6B2C] to-[#EA580C] border-[#FF6B2C] text-white shadow-md shadow-[#F97316]/25"
                        : "bg-white border-[#FFEDD5] text-[#221510] hover:border-[#F97316]/50 hover:bg-[#FFF7ED]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-bold line-clamp-1 ${active ? "text-white" : "text-[#221510]"}`}>
                          {m.name}
                        </span>
                        {active && (
                          <div className="w-4 h-4 rounded-full bg-white text-[#F97316] flex items-center justify-center shrink-0 shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      {m.subtitle && (
                        <p className={`text-[10px] mt-0.5 line-clamp-1 ${active ? "text-white/90" : "text-[#9A3412]/60"}`}>
                          {m.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-medium text-center">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!messId || isSubmitting}
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-zinc-50 border-2 border-[#FFEDD5] text-[#221510] font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.28 7.23 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.11 0 9.83 0 12s.43 3.89 1.19 5.42l4.09-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.72 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>{isSubmitting ? "Signing in..." : "Sign in with Google (@vitbhopal.ac.in)"}</span>
            </button>
            <p className="text-[10px] text-center text-[#C2410C]/70 mt-2 font-medium">
              Only official university accounts are permitted.
            </p>
          </div>

        </div>

      </div>

      <footer className="relative z-10 pt-1 pb-2 text-center w-full max-w-md px-6">
        <p className="text-[11px] text-[#C2410C]/70 font-medium">
          By entering, you agree to our{" "}
          <Link
            to="/privacy"
            className="font-bold underline text-[#EA580C] hover:text-[#FF6B2C] transition"
          >
            Privacy Policy & Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}