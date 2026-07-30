import { useState } from "react";
// ⚡ FIX: Import logStudentOnboarding helper
import { MESSES, saveProfile, logStudentOnboarding, type MessId, type StudentProfile } from "@/lib/messhub";
import { requestNotificationPermission, subscribeToMessTopic } from "@/lib/firebase";
import { z } from "zod";
import { User, Check } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(50),
  messId: z.enum(["crcl", "jmb", "mayuri_boys", "mayuri_girls", "safal", "ab_catering"]),
});

export function Onboarding({ onComplete }: { onComplete: (p: StudentProfile) => void }) {
  const [name, setName] = useState("");
  const [messId, setMessId] = useState<MessId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    console.log("Submit button clicked");

    const parsed = schema.safeParse({ name: name.trim(), messId });

    if (!parsed.success) {
      console.log("Validation failed");
      setError(parsed.error.issues[0]?.message ?? "Please check your inputs");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const profile = parsed.data;

    try {
      // 1. Save locally
      console.log("Saving profile locally...");
      saveProfile(profile);

      // 2. ⚡ Log student to Firestore and AWAIT response before proceeding
      console.log("Logging student onboarding to Firestore...");
      await logStudentOnboarding(profile);
      console.log("Firestore logging complete.");

      // 3. Setup notification permissions & topics
      console.log("Requesting notification permission...");
      const permission = await requestNotificationPermission();
      console.log("Permission status:", permission);

      if (permission === "granted") {
        console.log("Subscribing to topic...");
        await subscribeToMessTopic(profile.messId);
        console.log("Subscription complete.");
      }
    } catch (err) {
      console.error("Onboarding setup issue:", err);
    } finally {
      // 4. Transition into app ONLY after Firestore write finishes
      console.log("Calling onComplete...");
      onComplete(profile);
      setIsSubmitting(false);
    }
  }

  const canSubmit = name.trim().length > 0 && messId !== null;

  return (
    <div className="min-h-[100svh] w-full bg-[#FFF8F5] text-[#221510] flex flex-col justify-between items-center relative overflow-x-hidden font-sans select-none">
      
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
                Setup
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
        <div className="px-5 sm:px-6 pt-12 pb-6 flex flex-col gap-4 w-full flex-1 justify-center">
          
          {/* Full Name Input */}
          <div className="mt-2">
            <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative flex items-center bg-white rounded-2xl px-3.5 py-3 border-2 border-[#FFEDD5] focus-within:border-[#F97316] focus-within:ring-4 focus-within:ring-[#F97316]/10 transition-all shadow-sm">
              <User className="w-5 h-5 text-[#F97316] mr-2.5 shrink-0" />
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                placeholder="Enter your name"
                className="w-full bg-transparent text-sm sm:text-base text-[#221510] font-semibold placeholder-[#D4A391] focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Mess Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#C2410C] uppercase tracking-wider">
                Select Mess
              </label>
              <span className="text-[11px] text-[#C2410C]/70 font-medium">Choose assigned mess</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {MESSES.map((m) => {
                const active = messId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMessId(m.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all duration-150 relative flex flex-col justify-between border-2 cursor-pointer active:scale-[0.98] ${
                      active
                        ? "bg-gradient-to-br from-[#FF6B2C] to-[#EA580C] border-[#FF6B2C] text-white shadow-md shadow-[#F97316]/25"
                        : "bg-white border-[#FFEDD5] text-[#221510] hover:border-[#F97316]/50 hover:bg-[#FFF7ED]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs sm:text-sm font-bold line-clamp-1 ${active ? "text-white" : "text-[#221510]"}`}>
                          {m.name}
                        </span>
                        {active && (
                          <div className="w-4 h-4 rounded-full bg-white text-[#F97316] flex items-center justify-center shrink-0 shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      {m.subtitle && (
                        <p className={`text-[10px] sm:text-xs mt-0.5 line-clamp-1 ${active ? "text-white/90" : "text-[#9A3412]/60"}`}>
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
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              disabled={!canSubmit || isSubmitting}
              onClick={submit}
              className="w-full bg-gradient-to-r from-[#FF6B2C] via-[#F97316] to-[#EA580C] hover:opacity-95 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#F97316]/25 transition-all text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? "Setting up MessHub..." : "Enter MessHub"}
            </button>
            <p className="mt-2 text-center text-[11px] text-[#C2410C]/60 font-medium">
              Your info stays on this device.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}