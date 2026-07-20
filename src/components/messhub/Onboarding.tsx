import { useState } from "react";
import { MESSES, saveProfile, type MessId, type StudentProfile } from "@/lib/messhub";
import { requestNotificationPermission, subscribeToMessTopic } from "@/lib/firebase";
import { z } from "zod";

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

    console.log("Validation passed");
    const profile = parsed.data;

    console.log("Saving profile...");
    saveProfile(profile);

    try {
      console.log("Requesting notification permission...");
      const permission = await requestNotificationPermission();
      console.log("Permission:", permission);

      console.log("Subscribing to topic...");
      await subscribeToMessTopic(profile.messId, profile.name);
      console.log("Subscription complete.");
    } catch (err) {
      console.error("Notification setup failed:", err);
    } finally {
      console.log("Calling onComplete...");
      onComplete(profile);
      setIsSubmitting(false);
    }
  }

  const canSubmit = name.trim().length > 0 && messId !== null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] gradient-warm opacity-20" />
      <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full gradient-warm blur-3xl opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 safe-top safe-bottom">
        <header className="pt-4 pb-6">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl gradient-warm text-white text-lg shadow-card">🍽️</div>
            <span className="font-display text-lg font-bold tracking-tight">MessHub</span>
          </div>
        </header>

        <div className="flex-1">
          <h1 className="text-4xl font-bold leading-tight">
            Your campus <br />
            <span className="bg-clip-text text-transparent gradient-warm">dining companion.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Just your name and mess. No email, no OTP, no password.
          </p>

          <div className="mt-8">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Full name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                placeholder="Your Name"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
          </div>

          <div className="mt-6">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Assigned mess</span>
            <div className="grid grid-cols-2 gap-3">
              {MESSES.map((m) => {
                const active = messId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMessId(m.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="text-base font-semibold">{m.name}</div>
                    {m.subtitle && <div className="text-xs text-muted-foreground">{m.subtitle}</div>}
                    {active && <div className="mt-2 text-xs font-medium text-primary">Selected</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit || isSubmitting}
            onClick={submit}
            className="mt-8 w-full rounded-2xl gradient-warm px-6 py-4 font-semibold text-white shadow-card transition hover:opacity-95 disabled:opacity-40"
          >
            {isSubmitting ? "Setting up MessHub..." : "Enter MessHub"}
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your info stays on this device.
          </p>
        </div>
      </div>
    </div>
  );
}