"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth, adminDb } from "./firebase-admin";
import { checkRateLimit } from "./security";

type OperatorRole = "admin" | "super-admin" | "nutritionist";
type LoginArea = "admin" | "super-admin" | "nutritionist";

const LoginSchema = z.object({
  password: z.string().min(1).max(256),
  area: z.enum(["admin", "super-admin", "nutritionist"]),
});
const ChangeSchema = z.object({
  idToken: z.string().min(20),
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});
const TechnicalLoginSchema = z.object({ password: z.string().min(1).max(256) });
const TechnicalTokenSchema = z.object({ idToken: z.string().min(20) });
const ResetSchema = TechnicalTokenSchema.extend({ operatorId: z.string().regex(/^(admin_|super_admin$|nutritionist$)/), temporaryPassword: z.string().min(12).max(256) });

const ADMIN_MESSES = ["jmb", "mayuri_boys", "mayuri_girls", "rassense", "food_sutra", "safal", "anchor", "ab_catering"];
const encoder = new TextEncoder();
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;

type Db = NonNullable<typeof adminDb>;
type Ref = ReturnType<Db["doc"]>;

function hex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function derive(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 }, key, 256));
}

/** Format: pbkdf2-sha256$iterations$salt-hex$derived-key-hex */
export async function hashOperatorPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = hex(salt);
  return `pbkdf2-sha256$210000$${saltHex}$${await derive(password, saltHex)}`;
}

async function verifyOperatorPassword(password: string, stored: unknown) {
  if (typeof stored !== "string") return false;
  const [algorithm, iterations, saltHex, expected] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || iterations !== "210000" || !saltHex || !expected) return false;
  const actual = await derive(password, saltHex);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

async function sha256Hex(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function safeEqual(a: string, b: string) {
  const left = await sha256Hex(a);
  const right = await sha256Hex(b);
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

/** Hashed per-client key, so failed attempts are tracked per visitor, not per account. */
async function clientKey(scope: string) {
  let ip = "unknown";
  try {
    const server = await import("@tanstack/react-start/server");
    ip = server.getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || server.getRequestIP({ xForwardedFor: true }) || "unknown";
  } catch {
    // Fall back to one shared bucket when the request context is unavailable.
  }
  return (await sha256Hex(`${scope}|${ip}`)).slice(0, 40);
}

/** Turns a Firestore quota failure into a readable message instead of "wrong password". */
function explain(error: unknown): never {
  const text = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(text)) {
    throw new Error("Firestore daily quota is exhausted. Try again after the reset, or enable billing.");
  }
  throw error instanceof Error ? error : new Error(text);
}

async function recordFailure(database: Db, ref: Ref) {
  await database.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const previous = snap.data();
    const started: number = previous?.windowStart?.toMillis?.() ?? 0;
    const expired = Date.now() - started > LOCK_MS;
    const count = (expired ? 0 : Number(previous?.count || 0)) + 1;
    tx.set(ref, {
      count,
      windowStart: expired ? new Date() : previous?.windowStart,
      lockedUntil: count >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
    });
  });
}

function candidateIds(area: LoginArea) {
  if (area === "admin") return [...ADMIN_MESSES.map((messId) => `admin_${messId}`), "super_admin"];
  if (area === "nutritionist") return ["nutritionist", "super_admin"];
  return ["super_admin"];
}

export const loginOperator = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = LoginSchema.safeParse(data);
    if (!parsed.success) throw new Error("Invalid login request.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!adminDb || !adminAuth) throw new Error("Operator login is not configured on the server.");
    const database = adminDb;
    const authService = adminAuth;
    const attemptsRef = database.collection("operator_login_attempts").doc(await clientKey(`login:${data.area}`));

    try {
      const attempts = await attemptsRef.get();
      const lockedUntil: number = attempts.data()?.lockedUntil?.toMillis?.() ?? 0;
      if (lockedUntil > Date.now()) throw new Error("Too many failed attempts. Please try again in a few minutes.");

      const refs = candidateIds(data.area).map((id) => database.collection("operator_credentials").doc(id));
      const snaps = await database.getAll(...refs);
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const credential = snap.data()!;
        if (!(await verifyOperatorPassword(data.password, credential.passwordHash))) continue;

        const role = credential.role as OperatorRole;
        const messId = typeof credential.messId === "string" ? credential.messId : undefined;
        await snap.ref.update({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });
        if (attempts.exists) await attemptsRef.delete();
        const token = await authService.createCustomToken(`operator:${snap.id}`, { role, operatorId: snap.id, ...(messId ? { messId } : {}) });
        return { token, role, messId, mustChangePassword: credential.mustChangePassword === true };
      }

      // Failures are counted per client, never against every account.
      await recordFailure(database, attemptsRef);
    } catch (error) {
      explain(error);
    }
    throw new Error("Invalid password.");
  });

export const changeOperatorPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = ChangeSchema.safeParse(data);
    if (!parsed.success) throw new Error("Password must be at least 12 characters.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!adminDb || !adminAuth) throw new Error("Password service is not configured on the server.");
    const database = adminDb;
    const authService = adminAuth;
    const token = await authService.verifyIdToken(data.idToken);
    const operatorId = typeof token.operatorId === "string" ? token.operatorId : "";
    if (!operatorId) throw new Error("This session cannot change an operator password.");
    const ref = database.collection("operator_credentials").doc(operatorId);
    const snap = await ref.get();
    if (!snap.exists || !(await verifyOperatorPassword(data.oldPassword, snap.data()!.passwordHash))) {
      throw new Error("Current password is incorrect.");
    }
    await ref.update({
      passwordHash: await hashOperatorPassword(data.newPassword),
      mustChangePassword: false,
      lastChangedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    });
    await database.collection("admin_audit_logs").add({
      messId: snap.data()?.messId ?? "all",
      action: "Password Changed",
      details: `Operator password changed for ${operatorId}`,
      operatorRole: token.role ?? "unknown",
      timestamp: new Date(),
    });
    return { success: true };
  });

export const loginTechnical = createServerFn({ method: "POST" })
  .validator((data: unknown) => TechnicalLoginSchema.parse(data))
  .handler(async ({ data }) => {
    if (!adminAuth) throw new Error("Technical access is not configured on the server.");
    const secret = process.env.TECHNICAL_PASSWORD;
    if (!secret) throw new Error("TECHNICAL_PASSWORD is not set on the server.");
    // In-memory limiter on purpose: this login must keep working even when Firestore is unavailable.
    if (!checkRateLimit(`technical-login:${await clientKey("technical")}`, MAX_FAILURES, LOCK_MS)) {
      throw new Error("Too many attempts. Please try again in a few minutes.");
    }
    if (!(await safeEqual(data.password, secret))) throw new Error("Invalid technical password.");
    return { token: await adminAuth.createCustomToken("technical:console", { role: "technical", operatorId: "technical" }) };
  });

export const getTechnicalOperatorHistory = createServerFn({ method: "POST" })
  .validator((data: unknown) => TechnicalTokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (!adminAuth || !adminDb) throw new Error("Technical service is not configured.");
    const token = await adminAuth.verifyIdToken(data.idToken);
    if (token.role !== "technical") throw new Error("Technical access required.");
    const snapshot = await adminDb.collection("operator_credentials").get().catch(explain);
    return snapshot.docs.map((entry) => {
      const value = entry.data();
      return { id: entry.id, role: value.role, messId: value.messId || null, mustChangePassword: value.mustChangePassword === true, lastLoginAt: value.lastLoginAt?.toDate?.()?.toISOString() || null, lastChangedAt: value.lastChangedAt?.toDate?.()?.toISOString() || null };
    });
  });

export const resetOperatorPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) => ResetSchema.parse(data))
  .handler(async ({ data }) => {
    if (!adminAuth || !adminDb) throw new Error("Technical service is not configured.");
    const token = await adminAuth.verifyIdToken(data.idToken);
    if (token.role !== "technical") throw new Error("Technical access required.");
    const ref = adminDb.collection("operator_credentials").doc(data.operatorId);
    if (!(await ref.get()).exists) throw new Error("Operator account not found.");
    await ref.update({ passwordHash: await hashOperatorPassword(data.temporaryPassword), mustChangePassword: true, lastChangedAt: new Date(), failedAttempts: 0, lockedUntil: null });
    await adminDb.collection("admin_audit_logs").add({ messId: "all", action: "Technical Password Reset", details: `Reset password for ${data.operatorId}`, operatorRole: "technical", timestamp: new Date() });
    return { success: true };
  });

export const unlockLogins = createServerFn({ method: "POST" })
  .validator((data: unknown) => TechnicalTokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (!adminAuth || !adminDb) throw new Error("Technical service is not configured.");
    const token = await adminAuth.verifyIdToken(data.idToken);
    if (token.role !== "technical") throw new Error("Technical access required.");
    const database = adminDb;
    try {
      const attempts = await database.collection("operator_login_attempts").get();
      const credentials = await database.collection("operator_credentials").get();
      const batch = database.batch();
      attempts.docs.forEach((entry) => batch.delete(entry.ref));
      credentials.docs.forEach((entry) => batch.update(entry.ref, { failedAttempts: 0, lockedUntil: null }));
      await batch.commit();
      await database.collection("admin_audit_logs").add({ messId: "all", action: "Logins Unlocked", details: "Technical console cleared login lockouts", operatorRole: "technical", timestamp: new Date() });
      return { clearedClients: attempts.size, accounts: credentials.size };
    } catch (error) {
      explain(error);
    }
  });
