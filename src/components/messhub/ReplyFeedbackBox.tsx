import { useState } from "react";
import { CheckCircle2, MessageSquareReply } from "lucide-react";
import { auth } from "@/lib/firebase";
import { replyToFeedback } from "@/lib/reply-feedback-action";

function formatReplyTime(value: unknown): string {
  const date =
    value && typeof (value as { toDate?: unknown }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : value instanceof Date
        ? value
        : null;
  return date ? date.toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "";
}

export function ReplyFeedbackBox({
  feedbackId,
  replyText,
  repliedAt,
}: {
  feedbackId: string;
  replyText?: string;
  repliedAt?: unknown;
  /** @deprecated kept so old call sites still compile; use replyText instead */
  replied?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  // Reply sent from this card: shown instantly, before the list is reloaded.
  const [sentReply, setSentReply] = useState<{ text: string; at: Date } | null>(null);

  const shownText = sentReply?.text ?? replyText;
  const shownTime = formatReplyTime(sentReply?.at ?? repliedAt);

  async function send() {
    if (!auth?.currentUser || !text.trim()) return;
    setSending(true);
    setMessage("");
    try {
      const result = await replyToFeedback({
        data: { idToken: await auth.currentUser.getIdToken(), feedbackId, text },
      });
      setSentReply({ text: result.text, at: new Date() });
      setText("");
      if (result.sent > 0) {
        setMessage(`Reply sent. Notification delivered to ${result.sent} device${result.sent > 1 ? "s" : ""}.`);
      } else if (result.devices === 0) {
        setMessage("Reply saved. The student has no notification-enabled device, so they will see it in My feedback.");
      } else {
        setMessage("Reply saved, but the notification could not be delivered. The student will see it in My feedback.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[#B5DED4] pt-2">
      {shownText && (
        <div className="mb-2 rounded-xl border border-emerald-300 bg-emerald-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">
              <MessageSquareReply className="h-3.5 w-3.5" /> Reply sent to student
            </span>
            {shownTime && <span className="text-[10px] font-medium text-emerald-900/60">{shownTime}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs text-[#193A40]">{shownText}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Delivered to the student's My feedback
          </span>
        </div>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 1000))}
        placeholder={shownText ? "Send an updated reply" : "Write a reply to this student"}
        className="min-h-16 w-full rounded-lg border border-[#B5DED4] p-2 text-xs"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#193A40]/60">
          {text.length}/1000 {message}
        </span>
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void send()}
          className="shrink-0 rounded-lg bg-[#007F86] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
