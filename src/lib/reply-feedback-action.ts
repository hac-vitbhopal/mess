"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth, adminDb, adminMessaging } from "./firebase-admin";
import { sanitizePlainText } from "./security";

const ReplySchema = z.object({
  idToken: z.string().min(20),
  feedbackId: z.string().min(1).max(150),
  text: z.string().min(1).max(1000),
});

export const replyToFeedback = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = ReplySchema.safeParse(data);
    if (!parsed.success) throw new Error("Reply must be between 1 and 1,000 characters.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!adminAuth || !adminDb || !adminMessaging) throw new Error("Reply service is not configured.");
    const token = await adminAuth.verifyIdToken(data.idToken);
    const feedbackRef = adminDb.collection("item_feedback").doc(data.feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) throw new Error("Feedback no longer exists.");
    const feedback = feedbackSnap.data()!;
    const role = token.role;
    const mayReply = role === "super-admin" || role === "nutritionist" || (role === "admin" && token.messId === feedback.messId);
    if (!mayReply) throw new Error("You cannot reply to feedback for this mess.");

    const text = sanitizePlainText(data.text);
    if (!text) throw new Error("Reply cannot be empty.");
    await feedbackRef.update({
      replyText: text,
      replyingMessId: feedback.messId,
      repliedAt: new Date(),
      replySeenByStudent: false,
      status: "solved",
    });
    await adminDb.collection("admin_audit_logs").add({
      messId: feedback.messId,
      action: "Feedback Reply",
      details: `Replied to feedback ${data.feedbackId}`,
      operatorRole: role || "unknown",
      timestamp: new Date(),
    });

    const studentEmail = typeof feedback.studentEmail === "string" ? feedback.studentEmail.trim() : "";
    if (!studentEmail) return { success: true, text, sent: 0, devices: 0 };

    // Tokens are stored lowercase; also try the address exactly as the student typed it.
    const emails = Array.from(new Set([studentEmail.toLowerCase(), studentEmail]));
    const database = adminDb;
    const messaging = adminMessaging;
    const tokenSnap = await database.collection("fcm_tokens").where("email", "in", emails).get();
    const devices = tokenSnap.docs
      .map((item) => ({ id: item.id, token: item.data().token }))
      .filter((item): item is { id: string; token: string } => typeof item.token === "string");

    const title = "Your mess feedback has a reply";
    const body = text.slice(0, 160);
    const url = "/?section=my-feedback";
    const tag = `feedback-reply-${data.feedbackId}`;
    let sent = 0;
    for (let i = 0; i < devices.length; i += 500) {
      const batch = devices.slice(i, i + 500);
      try {
        const result = await messaging.sendEachForMulticast({
          tokens: batch.map((item) => item.token),
          notification: { title, body },
          // Same shape as the working broadcast notifications; the service worker reads these.
          data: { title, body, url, tag, feedbackId: data.feedbackId, type: "feedback_reply" },
          webpush: {
            headers: { Urgency: "high" },
            notification: { title, body, icon: "/mess_logo.png", badge: "/mess_logo.png", tag, requireInteraction: true },
            fcmOptions: { link: url },
          },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        });
        sent += result.successCount;
        // Drop tokens FCM says are dead so they stop counting as devices.
        const dead: Promise<unknown>[] = [];
        result.responses.forEach((res, index) => {
          const code = res.error?.code;
          if (!res.success && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token")) {
            dead.push(database.collection("fcm_tokens").doc(batch[index].id).delete());
          }
        });
        await Promise.allSettled(dead);
      } catch (error) {
        console.error("[Reply notification] FCM send failed:", error);
      }
    }
    return { success: true, text, sent, devices: devices.length };
  });
