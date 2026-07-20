"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./firebase-admin";
import { z } from "zod";

const tokenPayloadSchema = z.object({
  token: z.string().trim().min(10).max(500),
  messId: z.enum(["crcl", "jmb", "mayuri_boys", "mayuri_girls", "safal", "ab_catering"]),
  name: z.string().trim().min(1).max(100).optional(), // 👈 Allow name parameter
});

export const registerFcmToken = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => tokenPayloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { token, messId, name } = data;

    try {
      await adminDb
        .collection("fcm_tokens")
        .doc(token)
        .set(
          {
            token,
            messId,
            ...(name ? { name } : {}), // 👈 Save student name in Firestore document
            updatedAt: new Date(),
          },
          { merge: true }
        );

      return { success: true };
    } catch (err: any) {
      console.error("Failed to save token:", err);
      return { success: false, error: err.message };
    }
  });