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

    try {
      console.log("Saving token:", token);
      console.log("Mess:", messId);

      // Store token using the token itself as the document id.
      // Calling set() with merge: true updates messId/updatedAt if the token already exists.
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

      console.log("✅ Token saved to Firestore");

      return {
        success: true,
      };
    } catch (err: any) {
      console.error("Failed to save token:", err);

      return {
        success: false,
        error: err.message,
      };
    }
  });