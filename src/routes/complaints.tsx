import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/complaints")({
  head: () => ({
    meta: [
      { title: "Submit a complaint — MessHub" },
      { name: "description", content: "Share feedback or a complaint about your mess." },
    ],
  }),
  component: ComplaintsPage,
});

const CATEGORIES = ["Food quality", "Hygiene", "Timing", "Staff behavior", "Other"] as const;

const schema = z.object({
  category: z.enum(CATEGORIES),
  message: z.string().trim().min(10, "Please describe the issue (min 10 chars)").max(3000),
});

function ComplaintsPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Food quality");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = schema.safeParse({ category, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    setSent(true);
    setTimeout(() => navigate({ to: "/" }), 1600);
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="safe-top px-5 pt-2 pb-4">
        <Link to="/" className="text-sm text-muted-foreground">← Back</Link>
        <h1 className="mt-2 text-2xl font-bold">Submit a complaint</h1>
        <p className="text-sm text-muted-foreground">Only your mess admin sees this. Be respectful.</p>
      </header>

      <main className="px-5">
        {sent ? (
          <div className="rounded-3xl border border-success/30 bg-success/10 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success text-2xl text-success-foreground">✓</div>
            <h2 className="mt-4 text-lg font-bold">Complaint received</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your mess admin has been notified.</p>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Category</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium">What happened?</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
                rows={6}
                placeholder="Describe the issue…"
                className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{message.length} / 3000</div>
            </label>

            {error && (
              <div role="alert" className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              className="mt-6 w-full rounded-2xl gradient-warm px-6 py-4 font-semibold text-white shadow-card transition hover:opacity-95"
            >
              Send complaint
            </button>
          </>
        )}
      </main>
    </div>
  );
}
