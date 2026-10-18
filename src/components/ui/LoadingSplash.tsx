// src/components/LoadingSplash.tsx
import { Utensils, Sparkles } from "lucide-react";

export function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#E9F7F4] text-[#193A40] font-sans select-none">
      {/* Background soft ambient glow */}
      <div className="absolute w-64 h-64 bg-[#007F86]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-xs text-center px-6">
        
        {/* Bouncing / Pulsing Brand Logo Badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-white shadow-xl shadow-[#007F86]/15 border-4 border-[#B5DED4] flex items-center justify-center overflow-hidden animate-bounce">
            <img
              src="/mess_logo.png"
              alt="VITMESS Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#007F86] text-white flex items-center justify-center shadow-md animate-pulse">
            <Utensils className="w-4 h-4" />
          </div>
        </div>

        {/* Brand Title */}
        <h2 className="text-2xl font-black text-[#193A40] tracking-tight">
          VITMESS
        </h2>
        <p className="text-xs font-semibold text-[#007F86] mt-1 uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Preparing your plate...
        </p>

        {/* Swiggy/Zomato style animated loading dots bar */}
        <div className="mt-6 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#007F86] animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#007F86] animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#007F86] animate-bounce" />
        </div>

      </div>
    </div>
  );
}