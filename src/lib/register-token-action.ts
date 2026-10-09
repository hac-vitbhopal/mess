"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb, adminMessaging } from "./firebase-admin";
import { z } from "zod";

const tokenPayloadSchema = z.object({
  token: z.string().trim().min(10).max(500),
  messId: z.string().trim().min(1).max(50),
  name: z.string().trim().max(100).nullable().optional(),
  email: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().email().nullable().optional()
  ),
});

export const registerFcmToken = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => {
    const parsed = tokenPayloadSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Invalid token payload: ${parsed.error.issues.map(i => i.message).join(", ")}`);
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { token, messId, name, email } = data;

    // Check if Admin SDK is configured
    if (!adminDb || !adminMessaging) {
      console.warn("[FCM Server] Skipping server registration: Admin SDK credentials not configured in environment.");
      return { success: true, warning: "Admin SDK not configured in local environment." };
    }

    try {
      if (email && email.trim() !== "") {
        const lowerEmail = email.toLowerCase().trim();
        if (!lowerEmail.endsWith("@vitbhopal.ac.in")) {
          throw new Error("Unauthorized domain. Only official @vitbhopal.ac.in emails are permitted.");
        }
      }

      // 1. Save token document
      await adminDb
        .collection("fcm_tokens")
        .doc(token)
        .set(
          {
            token,
            messId,
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            updatedAt: new Date(),
          },
          { merge: true }
        );

      // 2. Subscribe to FCM topic
      await adminMessaging.subscribeToTopic([token], `mess_${messId}`);
      await adminMessaging.subscribeToTopic([token], "mess_all");

      return { success: true };
    } catch (err: any) {
      console.error("Failed to register token:", err);
      return {
        success: false,
        error: err.message?.includes("Unauthorized domain")
          ? err.message
          : "An error occurred while registering the notification device.",
      };
    }
  }); 