import { createFileRoute, Link } from "@tanstack/react-router";
import { MESSES } from "@/lib/messhub";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super admin — MessHub" },
      { name: "description", content: "Platform-wide overview of every mess." },
    ],
  }),
  component: SuperAdminDashboard,
});

const MESS_STATS: Record<string, { students: number; active: number; attended: number; complaints: number; rating: number; broadcasts: number; menu: "Published" | "Draft" }> = {
  crcl: { students: 412, active: 380, attended: 318, complaints: 3, rating: 4.3, broadcasts: 2, menu: "Published" },
  jmb: { students: 298, active: 260, attended: 210, complaints: 1, rating: 4.5, broadcasts: 1, menu: "Published" },
  mayuri_boys: { students: 355, active: 320, attended: 260, complaints: 5, rating: 4.1, broadcasts: 3, menu: "Published" },
  mayuri_girls: { students: 302, active: 285, attended: 240, complaints: 2, rating: 4.4, broadcasts: 1, menu: "Published" },
  safal: { students: 189, active: 170, attended: 135, complaints: 0, rating: 4.6, broadcasts: 0, menu: "Draft" },
  ab_catering: { students: 244, active: 220, attended: 180, complaints: 4, rating: 3.9, broadcasts: 2, menu: "Published" },
};

function SuperAdminDashboard() {
  const totalStudents = Object.values(MESS_STATS).reduce((a, b) => a + b.students, 0);
  const totalActive = Object.values(MESS_STATS).reduce((a, b) => a + b.active, 0);
  const totalComplaints = Object.values(MESS_STATS).reduce((a, b) => a + b.complaints, 0);
  const avgRating = (Object.values(MESS_STATS).reduce((a, b) => a + b.rating, 0) / MESSES.length).toFixed(2);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="safe-top border-b border-border bg-card/60 px-5 pb-4 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Super admin</p>
            <h1 className="truncate text-xl font-bold">Platform overview</h1>
          </div>
          <Link to="/" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm shadow-card">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigStat label="Total students" value={totalStudents.toLocaleString()} />
          <BigStat label="Active today" value={totalActive.toLocaleString()} />
          <BigStat label="Avg rating" value={avgRating} />
          <BigStat label="Open complaints" value={String(totalComplaints)} />
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold">All messes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MESSES.map((mess) => {
              const s = MESS_STATS[mess.id];
              return (
                <article key={mess.id} className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elevated">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">
                        {mess.name}
                        {mess.subtitle && <span className="ml-1 text-sm font-normal text-muted-foreground">({mess.subtitle})</span>}
                      </h3>
                      <p className="text-xs text-muted-foreground">{s.students} students enrolled</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        s.menu === "Published"
                          ? "bg-success/15 text-success"
                          : "bg-warning/20 text-foreground"
                      }`}
                    >
                      {s.menu}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Active" value={s.active} />
                    <MiniStat label="Attended" value={`~${s.attended}`} />
                    <MiniStat label="Rating" value={s.rating.toFixed(1)} />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.broadcasts} broadcasts today</span>
                    <span>{s.complaints} complaints</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary/60 py-2">
      <div className="font-display text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
