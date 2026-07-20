"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./firebase-admin";
import { z } from "zod";

// Strict Zod schema enforcing payload bounds
const tokenPayloadSchema = z.object({
  token: z.string().trim().min(10).max(500, "Token string exceeds maximum length limit"),
  messId: z.enum(["crcl", "jmb", "mayuri_boys", "mayuri_girls", "safal", "ab_catering"]),
});

export const registerFcmToken = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => tokenPayloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { token, messId } = data;

    try {
      await adminDb
        .collection("fcm_tokens")
        .doc(token)
        .set(
          {
            token,
            messId,
            updatedAt: new Date(),
          },
          { merge: true }
        );

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: "Internal database update failure",
      };
    }
  });