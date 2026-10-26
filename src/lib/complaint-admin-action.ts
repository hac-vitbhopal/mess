"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth, adminDb } from "./firebase-admin";

const StatusSchema = z.object({
  idToken: z.string().min(20),
  complaintId: z.string().min(1).max(150),
  status: z.enum(["solved", "unsolved"]),
});
const DeleteSchema = z.object({
  idToken: z.string().min(20),
  complaintId: z.string().min(1).max(150),
});

async function requireSuperAdmin(idToken: string) {
  if (!adminAuth || !adminDb) throw new Error("Firebase Admin is not configured on the server.");
  const token = await adminAuth.verifyIdToken(idToken);
  if (token.role !== "super-admin") throw new Error("Super admin access required.");
  return { auth: adminAuth, db: adminDb, token };
}

/** Server-side so it works regardless of Firestore client rules. */
export const setComplaintStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => StatusSchema.parse(data))
  .handler(async ({ data }) => {
    const { db } = await requireSuperAdmin(data.idToken);
    const ref = db.collection("complaints").doc(data.complaintId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Complaint no longer exists.");
    await ref.update({ status: data.status });
    await db.collection("admin_audit_logs").add({
      messId: String(snap.data()?.messId ?? "all"),
      action: "Complaint Status Update",
      details: `Marked complaint from ${snap.data()?.studentName ?? "Student"} as ${data.status}`,
      operatorRole: "super-admin",
      timestamp: new Date(),
    });
    return { success: true, status: data.status };
  });

export const deleteComplaint = createServerFn({ method: "POST" })
  .validator((data: unknown) => DeleteSchema.parse(data))
  .handler(async ({ data }) => {
    const { db } = await requireSuperAdmin(data.idToken);
    const ref = db.collection("complaints").doc(data.complaintId);
    const snap = await ref.get();
    if (!snap.exists) return { success: true };
    await ref.delete();
    await db.collection("admin_audit_logs").add({
      messId: String(snap.data()?.messId ?? "all"),
      action: "Complaint Deleted",
      details: `Removed complaint report from ${snap.data()?.studentName ?? "Student"}`,
      operatorRole: "super-admin",
      timestamp: new Date(),
    });
    return { success: true };
  });
