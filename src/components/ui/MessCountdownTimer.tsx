import { Sparkles, Clock } from "lucide-react";

interface TimerProps {
  focus: {
    name: string;
    startH: number;
    startM: number;
    endH: number;
    endM: number;
  };
  focusIsLive: boolean;
  countdown: {
    hours: number;
    mins: number;
    secs: number;
  };
}

export function MessCountdownTimer({ focus, focusIsLive, countdown }: TimerProps) {
  // Dynamic label rules based on your exact specifications
  const statusLabel = focusIsLive ? "Mess to close in" : "Mess to open in";

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007F86] to-[#193A40] p-6 text-white shadow-xl border border-[#B5DED4]/30">
      {/* Decorative background glow elements */}
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#B5DED4]/15 blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Top Tag: Live Badge vs Next Meal Badge */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#E9F7F4] bg-white/15 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20">
            {focusIsLive ? (
              <>
                <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-300 font-black">Kitchen is Live</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#B5DED4]" />
                <span>Up Next on Menu</span>
              </>
            )}
          </div>
        </div>

        {/* Meal Title */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
              {focus.name}
            </h2>
            <p className="text-xs font-medium text-[#E9F7F4]/80 mt-0.5">
              {focusIsLive ? "Fresh food being served right now across counters." : "Get ready for the upcoming service."}
            </p>
          </div>
          
          <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md items-center justify-center border border-white/20 text-white">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="my-5 h-[1px] w-full bg-white/15" />

        {/* Creative Countdown Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/25 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#B5DED4] block">
              {statusLabel}
            </span>
            <span className="text-[10px] text-white/60 font-medium">
              {focusIsLive ? "Hurry up before counters close!" : "Patience, delicious meals incoming."}
            </span>
          </div>

          {/* Flip-style Minimal Clock Boxes */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center bg-white text-[#193A40] px-3 py-1.5 rounded-xl shadow-lg border border-[#B5DED4]">
              <span className="font-display text-xl font-black tracking-tighter tabular-nums">
                {String(countdown.hours).padStart(2, "0")}
              </span>
              <span className="text-[9px] font-bold text-[#007F86] uppercase tracking-wider">Hrs</span>
            </div>

            <span className="text-white/80 font-black text-lg">:</span>

            <div className="flex flex-col items-center bg-white text-[#193A40] px-3 py-1.5 rounded-xl shadow-lg border border-[#B5DED4]">
              <span className="font-display text-xl font-black tracking-tighter tabular-nums">
                {String(countdown.mins).padStart(2, "0")}
              </span>
              <span className="text-[9px] font-bold text-[#007F86] uppercase tracking-wider">Mins</span>
            </div>

            <span className="text-white/80 font-black text-lg">:</span>

            <div className="flex flex-col items-center bg-[#007F86] text-white px-3 py-1.5 rounded-xl shadow-lg border border-white/20">
              <span className="font-display text-xl font-black tracking-tighter tabular-nums animate-pulse">
                {String(countdown.secs).padStart(2, "0")}
              </span>
              <span className="text-[9px] font-bold text-[#B5DED4] uppercase tracking-wider">Secs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}