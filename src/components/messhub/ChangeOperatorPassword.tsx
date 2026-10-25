import { useState } from "react";
import { auth } from "@/lib/firebase";
import { changeOperatorPassword } from "@/lib/operator-auth-action";

export function ChangeOperatorPassword({ variant = "inline" }: { variant?: "inline" | "sidebar" }) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!auth?.currentUser) { setMessage("Your session has expired. Please sign in again."); return; }
    setSaving(true); setMessage(null);
    try {
      await changeOperatorPassword({ data: {
        idToken: await auth.currentUser.getIdToken(), oldPassword, newPassword,
      } });
      setOldPassword(""); setNewPassword(""); setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change password.");
    } finally { setSaving(false); }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={variant === "sidebar"
          ? "w-full flex items-center justify-between text-xs font-bold text-[#007F86] hover:bg-[#E9F7F4] px-3 py-2 rounded-xl transition cursor-pointer"
          : "text-xs font-bold text-[#007F86] hover:underline"}
      >
        Change password
      </button>
      {open && <form onSubmit={submit} className={`absolute z-50 w-72 rounded-2xl border border-[#B5DED4] bg-white p-4 shadow-xl space-y-2 ${variant === "sidebar" ? "bottom-full left-0 mb-2" : "right-0 top-7"}`}>
        <p className="text-xs font-black text-[#193A40]">Change password</p>
        <input required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" className="w-full rounded-lg border border-[#B5DED4] px-3 py-2 text-xs" />
        <input required minLength={12} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (12+ characters)" className="w-full rounded-lg border border-[#B5DED4] px-3 py-2 text-xs" />
        {message && <p className="text-[11px] text-[#193A40]/70">{message}</p>}
        <button disabled={saving} className="w-full rounded-lg bg-[#007F86] py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save new password"}</button>
      </form>}
    </div>
  );
}
