import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useOperatorAuth } from "@/lib/use-operator-auth";
import { getTechnicalOperatorHistory, loginTechnical, resetOperatorPassword, unlockLogins } from "@/lib/operator-auth-action";

export const Route = createFileRoute("/technical")({ component: TechnicalPage });

type Operator = {
  id: string;
  role: string;
  messId: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lastChangedAt: string | null;
};

function TechnicalPage() {
  const { ready, claims } = useOperatorAuth();
  const authenticated = ready && claims?.role === "technical";

  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      setOperators(await getTechnicalOperatorHistory({ data: { idToken: await auth.currentUser.getIdToken() } }));
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not load operator accounts.");
    }
  }, []);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    // Read the value from the form itself so browser autofill/paste is never missed.
    const value = String(new FormData(event.currentTarget).get("password") ?? "");
    if (!value) {
      setError("Enter the technical password.");
      return;
    }
    setBusy(true);
    try {
      if (!auth) throw new Error("Firebase auth is unavailable.");
      const result = await loginTechnical({ data: { password: value } });
      await signInWithCustomToken(auth, result.token);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(operatorId: string) {
    const value = temporaryPassword[operatorId] || "";
    if (!auth?.currentUser) return;
    if (value.length < 12) {
      setError("Temporary password must be at least 12 characters.");
      return;
    }
    setError("");
    setNotice("");
    try {
      await resetOperatorPassword({ data: { idToken: await auth.currentUser.getIdToken(), operatorId, temporaryPassword: value } });
      setTemporaryPassword((current) => ({ ...current, [operatorId]: "" }));
      setNotice(`Password reset for ${operatorId}. Share the temporary password with the owner.`);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Reset failed.");
    }
  }

  async function unlock() {
    if (!auth?.currentUser) return;
    setError("");
    setNotice("");
    try {
      const result = await unlockLogins({ data: { idToken: await auth.currentUser.getIdToken() } });
      setNotice(`Login lockouts cleared (${result?.clearedClients ?? 0} locked clients, ${result?.accounts ?? 0} accounts).`);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not clear lockouts.");
    }
  }

  if (!ready) return <main className="min-h-screen bg-[#E9F7F4]" />;

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#E9F7F4] p-6 text-[#193A40]">
        <Link to="/" className="text-xs font-bold text-[#007F86]">← VITMESS</Link>
        <form onSubmit={login} className="mx-auto mt-32 max-w-sm rounded-3xl border-2 border-[#B5DED4] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black">Technical access</h1>
          <p className="mt-1 text-xs text-[#193A40]/70">Server-only technical password required.</p>
          <input
            autoFocus
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-5 w-full rounded-xl border border-[#B5DED4] p-3"
            placeholder="Technical password"
          />
          <button disabled={busy} className="mt-3 w-full rounded-xl bg-[#007F86] py-3 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Checking…" : "Open dashboard"}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#E9F7F4] p-5 text-[#193A40]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Technical dashboard</h1>
          <p className="mt-1 text-xs text-[#193A40]/70">Operator login history and password recovery.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-lg border border-[#B5DED4] bg-white px-3 py-2 text-xs font-bold text-[#007F86]">Reload</button>
          <button onClick={() => void unlock()} className="rounded-lg border border-[#B5DED4] bg-white px-3 py-2 text-xs font-bold text-[#007F86]">Clear login lockouts</button>
          <button onClick={() => auth && void signOut(auth)} className="rounded-lg bg-[#193A40] px-3 py-2 text-xs font-bold text-white">Sign out</button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</p>}

      <section className="mt-5 space-y-3">
        {operators.length === 0 && !error && <p className="text-xs italic text-[#193A40]/60">No operator accounts found yet.</p>}
        {operators.map((operator) => (
          <article key={operator.id} className="rounded-2xl border border-[#B5DED4] bg-white p-4">
            <p className="font-bold">
              {operator.id}{" "}
              <span className="text-xs text-[#007F86]">{operator.role}{operator.messId ? ` · ${operator.messId}` : ""}</span>
            </p>
            <p className="mt-1 text-xs">
              Last login: {operator.lastLoginAt ? new Date(operator.lastLoginAt).toLocaleString() : "Never"} · Password changed: {operator.lastChangedAt ? new Date(operator.lastChangedAt).toLocaleString() : "Never"}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={temporaryPassword[operator.id] || ""}
                onChange={(event) => setTemporaryPassword((current) => ({ ...current, [operator.id]: event.target.value }))}
                placeholder="Temporary password (12+)"
                className="flex-1 rounded-lg border border-[#B5DED4] px-3 py-2 text-xs"
              />
              <button onClick={() => void reset(operator.id)} className="rounded-lg bg-[#007F86] px-3 py-2 text-xs font-bold text-white">Reset</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
