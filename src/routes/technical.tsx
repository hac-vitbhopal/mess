import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useOperatorAuth } from "@/lib/use-operator-auth";
import { getTechnicalOperatorHistory, loginTechnical, resetOperatorPassword, unlockLogins } from "@/lib/operator-auth-action";
import { getTechnicalConsoleSnapshot, getTechnicalHealth } from "@/lib/technical-console-action";
import { MESSES } from "@/lib/messhub";

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

  const [tab, setTab] = useState<"operators" | "super-admin" | "admin" | "health">("operators");
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

      <nav className="mt-5 flex flex-wrap gap-2">
        {([
          ["operators", "Operators"],
          ["super-admin", "Super Admin view"],
          ["admin", "Admin view"],
          ["health", "System health"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${tab === id ? "bg-[#007F86] text-white" : "border border-[#B5DED4] bg-white text-[#007F86]"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "super-admin" && <ConsoleView key="super-admin" scope="super-admin" />}
      {tab === "admin" && <ConsoleView key="admin" scope="admin" />}
      {tab === "health" && <HealthView />}

      <section className={`mt-5 space-y-3 ${tab === "operators" ? "" : "hidden"}`}>
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


/* ---------------- Read-only debug consoles ---------------- */

type Section<T = any> = { ok: true; data: T } | { ok: false; error: string };

function fmt(value: any) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";
}

function ConsoleView({ scope }: { scope: "super-admin" | "admin" }) {
  const [messId, setMessId] = useState<string>(MESSES[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"complaints" | "feedback" | "broadcasts" | "audit" | "menus">("complaints");

  const refresh = useCallback(async () => {
    if (!auth?.currentUser) return;
    setLoading(true);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      setSnapshot(await getTechnicalConsoleSnapshot({ data: { idToken, scope, messId: scope === "admin" ? messId : undefined } }));
    } catch (value) {
      setSnapshot(null);
      setError(value instanceof Error ? value.message : "Could not load console data.");
    } finally {
      setLoading(false);
    }
  }, [scope, messId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sections: [typeof view, string][] = [
    ["complaints", "Complaints"],
    ["feedback", "Dish feedback"],
    ["broadcasts", "Broadcasts"],
    ["audit", "Audit log"],
    ["menus", "Menus"],
  ];

  const current: Section | undefined = snapshot?.[view === "audit" ? "audit" : view];

  return (
    <section className="mt-5 space-y-3">
      <p className="rounded-xl border border-[#B5DED4] bg-white p-3 text-xs">
        Read-only {scope === "super-admin" ? "Super Admin (all messes)" : "Admin (single mess)"} view, loaded on the server so Firestore rules cannot hide data.
        {snapshot?.students?.ok && <> Registered students: <b>{snapshot.students.data.count}</b>.</>}
      </p>

      {scope === "admin" && (
        <div className="flex flex-wrap gap-2">
          {MESSES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMessId(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${messId === m.id ? "bg-[#193A40] text-white" : "border border-[#B5DED4] bg-white"}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {sections.map(([id, label]) => {
          const sec: Section | undefined = snapshot?.[id];
          const count = sec?.ok && Array.isArray(sec.data) ? sec.data.length : null;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === id ? "bg-[#007F86] text-white" : "border border-[#B5DED4] bg-white text-[#007F86]"}`}
            >
              {label}{count !== null ? ` (${count})` : ""}{sec && !sec.ok ? " ⚠" : ""}
            </button>
          );
        })}
        <button onClick={() => void refresh()} className="ml-auto rounded-lg border border-[#B5DED4] bg-white px-3 py-1.5 text-xs font-bold text-[#007F86]">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {current && !current.ok && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{current.error}</p>}
      {current?.ok && Array.isArray(current.data) && current.data.length === 0 && (
        <p className="text-xs italic text-[#193A40]/60">Nothing here.</p>
      )}

      {current?.ok && Array.isArray(current.data) && current.data.map((row: any) => (
        <article key={row.id} className="rounded-2xl border border-[#B5DED4] bg-white p-3 text-xs space-y-1">
          {view === "complaints" && (
            <>
              <p className="font-bold">{row.category || "Report"} <span className="text-[#007F86]">({row.messId})</span> · {row.status === "solved" ? "✅ solved" : "🕓 pending"}</p>
              <p>👤 {row.studentName || "Anonymous"} {row.email ? `(${row.email})` : ""} · {fmt(row.createdAt)}</p>
              <p className="italic">“{row.message}”</p>
            </>
          )}
          {view === "feedback" && (
            <>
              <p className="font-bold">{row.itemName} <span className="text-[#007F86]">({row.messId} · {row.mealKey})</span> · ⭐ {row.rating} · {row.status}</p>
              <p>👤 {row.studentName} · {fmt(row.createdAt)}</p>
              {row.comment && <p className="italic">“{row.comment}”</p>}
              {row.replyText && <p>↳ Reply: {row.replyText}</p>}
            </>
          )}
          {view === "broadcasts" && (
            <>
              <p className="font-bold">{row.title} <span className="text-[#007F86]">({row.messId})</span> · {fmt(row.createdAt)}</p>
              <p>{row.body}</p>
            </>
          )}
          {view === "audit" && (
            <>
              <p className="font-bold">{row.action} <span className="text-[#007F86]">({row.operatorRole} · {row.messId})</span></p>
              <p>{row.details} · {fmt(row.timestamp)}</p>
            </>
          )}
          {view === "menus" && (
            <details>
              <summary className="cursor-pointer font-bold">{row.id} · {fmt(row.updatedAt)}</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#E9F7F4] p-2 text-[10px]">{JSON.stringify(row, null, 2)}</pre>
            </details>
          )}
        </article>
      ))}
    </section>
  );
}

function HealthView() {
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      setHealth(await getTechnicalHealth({ data: { idToken: await auth.currentUser.getIdToken() } }));
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not run health check.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const Row = ({ label, ok }: { label: string; ok: boolean }) => (
    <li className="flex justify-between rounded-lg border border-[#B5DED4] bg-white px-3 py-2 text-xs">
      <span className="font-mono">{label}</span>
      <span className={ok ? "font-bold text-emerald-700" : "font-bold text-red-600"}>{ok ? "set" : "MISSING"}</span>
    </li>
  );

  return (
    <section className="mt-5 space-y-3">
      <p className="text-xs text-[#193A40]/70">Shows whether each server setting exists. Values are never displayed.</p>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {health && (
        <>
          <ul className="space-y-1.5">
            {Object.entries(health.env).map(([k, v]) => <Row key={k} label={k} ok={Boolean(v)} />)}
            <Row label="Apps Script URL format (…/macros/s/ID/exec)" ok={health.appsScriptUrlLooksValid} />
          </ul>
          <ul className="space-y-1.5">
            <Row label="Firebase Admin auth" ok={health.services.firebaseAdminAuth} />
            <Row label="Firestore (admin)" ok={health.services.firestoreAdmin} />
            <Row label="Push messaging" ok={health.services.messaging} />
          </ul>
        </>
      )}
      <button onClick={() => void refresh()} className="rounded-lg border border-[#B5DED4] bg-white px-3 py-2 text-xs font-bold text-[#007F86]">Re-check</button>
    </section>
  );
}
