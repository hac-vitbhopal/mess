"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./firebase-admin";
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
  .validator((data: unknown) => tokenPayloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { token, messId, name, email } = data;

    try {
      // 🔒 Optional validation: If an email is provided, ensure it belongs to VIT Bhopal domain
      if (email && email.trim() !== "") {
        const lowerEmail = email.toLowerCase().trim();
        if (!lowerEmail.endsWith("@vitbhopal.ac.in")) {
          throw new Error("Unauthorized domain. Only official @vitbhopal.ac.in emails are permitted.");
        }
      }

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

      return { success: true };
    } catch (err: any) {
      console.error("Failed to save token:", err);
      // 🔒 Prevent raw internal error leaks
      return { 
        success: false, 
        error: err.message?.includes("Unauthorized domain") 
          ? err.message 
          : "An error occurred while registering the notification device." 
      };
    }
  });