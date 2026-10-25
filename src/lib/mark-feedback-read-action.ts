"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth, adminDb } from "./firebase-admin";

const MarkReadSchema = z.object({
  idToken: z.string().min(20),
  feedbackIds: z.array(z.string().min(1).max(150)).min(1).max(50),
});

/**
 * Lets a signed-in student mark replies to THEIR OWN feedback as read.
 * Runs with the Admin SDK, so it works no matter what the Firestore client rules say,
 * and it only touches documents whose studentEmail matches the verified Google account.
 */
export const markFeedbackRead = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = MarkReadSchema.safeParse(data);
    if (!parsed.success) throw new Error("Invalid request.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!adminAuth || !adminDb) throw new Error("This service is not configured on the server.");
    const database = adminDb;
    const token = await adminAuth.verifyIdToken(data.idToken);
    const email = typeof token.email === "string" ? token.email.toLowerCase() : "";
    if (!email) throw new Error("Please sign in with your VIT Google account.");

    const refs = data.feedbackIds.map((id) => database.collection("item_feedback").doc(id));
    const snaps = await database.getAll(...refs);
    const batch = database.batch();
    let updated = 0;
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const owner = String(snap.data()?.studentEmail ?? "").toLowerCase();
      if (owner !== email) continue;
      batch.update(snap.ref, { replySeenByStudent: true });
      updated += 1;
    }
    if (updated > 0) await batch.commit();
    return { success: true, updated };
  });
