"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./firebase-admin";

interface RegisterTokenPayload {
  token: string;
  messId: string;
}

export const registerFcmToken = createServerFn({
  method: "POST",
})
  .validator((data: RegisterTokenPayload) => data)
  .handler(async ({ data }) => {
    const { token, messId } = data;

    if (!token || !messId) {
      throw new Error("Token and messId are required.");
    }

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
          {
            merge: true,
          }
        );

      console.log(
        `[FCM] Registered token for ${messId.substring(0, 20)}...`
      );

      return {
        success: true,
      };
    } catch (err) {
      console.error("[FCM] Token registration failed:", err);

      throw err;
    }
  });