// src/components/LoadingSplash.tsx
import { Sparkles } from "lucide-react";

export function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#E9F7F4] text-[#193A40] font-sans select-none">
      {/* Background soft ambient glow */}
      <div className="absolute w-72 h-72 bg-[#007F86]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-xs text-center px-6">
        
        {/* Custom Food Delivery Animation/GIF Container */}
        <div className="relative mb-5">
          <div className="w-28 h-28 rounded-3xl bg-white shadow-xl shadow-[#007F86]/15 border-2 border-[#B5DED4] flex items-center justify-center overflow-hidden p-3 animate-pulse">
            <img
              src="/food-delivery.gif" 
              alt="Food Delivery Loading"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Brand Title */}
        <h2 className="text-2xl font-black text-[#193A40] tracking-tight">
          VITMESS
        </h2>

        {/* Custom Tagline right below the GIF */}
        <p className="text-xs font-bold text-[#007F86] mt-1 tracking-wide">
          Your mess. Your voice. Your menu
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