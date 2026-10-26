"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth, adminDb, adminMessaging } from "./firebase-admin";

const SnapshotSchema = z.object({
  idToken: z.string().min(20),
  scope: z.enum(["super-admin", "admin"]),
  messId: z.string().max(50).optional(),
});

const HealthSchema = z.object({ idToken: z.string().min(20) });

/** Converts Firestore Timestamps etc. into JSON-safe values. */
function plain(value: any): any {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

function millis(value: any): number {
  const t = value ? Date.parse(value) : 0;
  return Number.isNaN(t) ? 0 : t;
}

async function requireTechnical(idToken: string) {
  if (!adminAuth || !adminDb) throw new Error("Technical service is not configured.");
  const token = await adminAuth.verifyIdToken(idToken);
  if (token.role !== "technical") throw new Error("Technical access required.");
  return adminDb;
}

async function load(db: FirebaseFirestore.Firestore, name: string, messId: string | null, max: number, sortField: string) {
  // Filter + sort in JS so no composite Firestore indexes are required.
  const base = messId ? db.collection(name).where("messId", "==", messId) : db.collection(name);
  const snap = await base.limit(500).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
  rows.sort((a: any, b: any) => millis(b[sortField]) - millis(a[sortField]));
  return rows.slice(0, max);
}

/** Read-only copy of what the Super Admin / a single mess Admin console would load. */
export const getTechnicalConsoleSnapshot = createServerFn({ method: "POST" })
  .validator((data: unknown) => SnapshotSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await requireTechnical(data.idToken);
    const messId = data.scope === "admin" ? data.messId ?? null : null;
    if (data.scope === "admin" && !messId) throw new Error("Pick a mess first.");

    const section = async <T,>(label: string, run: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
      try {
        return { ok: true, data: await run() };
      } catch (err) {
        return { ok: false, error: `${label}: ${err instanceof Error ? err.message : String(err)}` };
      }
    };

    const [complaints, feedback, broadcasts, audit, menus, students] = await Promise.all([
      section("complaints", () => load(db, "complaints", messId, 100, "createdAt")),
      section("item_feedback", () => load(db, "item_feedback", messId, 100, "createdAt")),
      section("broadcasts", () => load(db, "broadcasts", messId, 50, "createdAt")),
      section("admin_audit_logs", () => load(db, "admin_audit_logs", messId, 100, "timestamp")),
      section("mess_menus", async () => {
        const snap = await db.collection("mess_menus").limit(200).get();
        const rows = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
        const scoped = messId ? rows.filter((r: any) => r.messId === messId || r.id.startsWith(`${messId}_`)) : rows;
        scoped.sort((a: any, b: any) => millis(b.updatedAt) - millis(a.updatedAt));
        return scoped.slice(0, 50);
      }),
      section("registered_students", async () => {
        const base = messId ? db.collection("registered_students").where("messId", "==", messId) : db.collection("registered_students");
        const c = await base.count().get();
        return { count: c.data().count };
      }),
    ]);

    return { scope: data.scope, messId, complaints, feedback, broadcasts, audit, menus, students };
  });

/** Booleans only: tells you which server settings are present, never their values. */
export const getTechnicalHealth = createServerFn({ method: "POST" })
  .validator((data: unknown) => HealthSchema.parse(data))
  .handler(async ({ data }) => {
    await requireTechnical(data.idToken);
    const has = (k: string) => Boolean(process.env[k]);
    return {
      env: Object.fromEntries(
        [
          "FIREBASE_PROJECT_ID",
          "FIREBASE_CLIENT_EMAIL",
          "FIREBASE_PRIVATE_KEY",
          "SUPER_ADMIN_EMAIL",
          "ADMIN_ACCESS_KEY",
          "TECHNICAL_PASSWORD",
          "GOOGLE_APPS_SCRIPT_URL",
          "GOOGLE_APPS_SCRIPT_SECRET",
        ].map((k) => [k, has(k)]),
      ),
      services: { firebaseAdminAuth: !!adminAuth, firestoreAdmin: !!adminDb, messaging: !!adminMessaging },
      appsScriptUrlLooksValid: /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(process.env.GOOGLE_APPS_SCRIPT_URL ?? ""),
    };
  });
