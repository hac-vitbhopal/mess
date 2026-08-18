import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toggleFeedbackStatus, MESSES, type ItemFeedback, type MessId } from "@/lib/messhub";
import { CheckSquare, Square, Star, AlertCircle, CheckCircle2 } from "lucide-react";

export function DishFeedbackViewer({ messId }: { messId?: MessId | "all" }) {
  const [feedbacks, setFeedbacks] = useState<ItemFeedback[]>([]);
  const [filter, setFilter] = useState<"all" | "unsolved" | "solved">("all");

  useEffect(() => {
    if (!db) return;

    // Filter by specific Mess ID if provided (for Mess Admin) or load all (for Super Admin)
    const baseQuery = messId && messId !== "all"
      ? query(collection(db, "item_feedback"), where("messId", "==", messId), orderBy("createdAt", "desc"))
      : query(collection(db, "item_feedback"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(baseQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemFeedback));
      setFeedbacks(list);
    });

    return () => unsub();
  }, [messId]);

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === "unsolved") return f.status === "unsolved";
    if (filter === "solved") return f.status === "solved";
    return true;
  });

  const getMessLabel = (id: string) => {
    const found = MESSES.find((m) => m.id === id);
    return found ? `${found.name}${found.subtitle ? ` (${found.subtitle})` : ""}` : id.toUpperCase();
  };

  return (
    <div className="bg-white border-2 border-[#FFEDD5] rounded-3xl p-5 shadow-sm space-y-4 my-6 font-sans select-none">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#FFEDD5]">
        <div>
          <h2 className="text-base font-black text-[#221510] flex items-center gap-2">
            <span>🍲</span> Student Dish Feedback ({feedbacks.length})
          </h2>
          <p className="text-xs text-[#C2410C]/80 mt-0.5">
            {messId && messId !== "all" ? `Filtered for ${getMessLabel(messId)}` : "Live feedback across all mess facilities"}
          </p>
        </div>

        {/* Filter Toggle Buttons */}
        <div className="flex items-center gap-1 bg-[#FFF8F5] p-1 rounded-xl border border-[#FFEDD5]">
          {(["all", "unsolved", "solved"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg capitalize transition cursor-pointer ${
                filter === type
                  ? "bg-[#F97316] text-white shadow-xs"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback List */}
      {filteredFeedbacks.length === 0 ? (
        <p className="text-xs italic text-[#C2410C]/60 text-center py-8">
          No {filter !== "all" ? filter : ""} feedback entries found.
        </p>
      ) : (
        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
          {filteredFeedbacks.map((item) => {
            const isSolved = item.status === "solved";
            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                  isSolved ? "bg-emerald-50/50 border-emerald-200" : "bg-[#FFF8F5] border-[#FFEDD5]"
                }`}
              >
                {/* Solved/Unsolved Checkbox Toggle */}
                <button
                  type="button"
                  onClick={() => item.id && toggleFeedbackStatus(item.id, item.status)}
                  className="mt-0.5 text-[#F97316] hover:scale-110 transition cursor-pointer shrink-0"
                  title={isSolved ? "Mark as Unsolved" : "Mark as Solved"}
                >
                  {isSolved ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Dish Name & Rating */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-[#221510] truncate">
                      {item.itemName} <span className="uppercase text-[9px] text-[#C2410C] font-semibold">({item.mealKey})</span>
                    </span>

                    {/* Star Rating Display */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= item.rating ? "fill-amber-500 text-amber-500" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Student Details & Mess Tag */}
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium">
                    <span>👤 {item.studentName} {item.studentEmail ? `(${item.studentEmail})` : ""}</span>
                    <span className="bg-[#FFEDD5] text-[#C2410C] px-2 py-0.5 rounded-full font-bold uppercase text-[9px]">
                      {getMessLabel(item.messId)}
                    </span>
                  </div>

                  {/* Comment */}
                  {item.comment && (
                    <p className="text-xs italic text-gray-700 bg-white p-2 rounded-xl border border-[#FFEDD5] mt-1">
                      "{item.comment}"
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="pt-1 flex items-center justify-end">
                    {isSolved ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Solved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Pending Resolution
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}