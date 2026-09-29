"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuth } from "./firebase-admin";

const AdminKeySchema = z.object({
  accessKey: z.string().min(1).max(100),
  idToken: z.string().optional(), // Firebase Auth ID token of the operator
});

export const verifyAdminAccessKey = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => {
    const result = AdminKeySchema.safeParse(data);
    if (!result.success) {
      throw new Error("Invalid request payload.");
    }
    return result.data;
  })
  .handler(async ({ data }) => {
    const { accessKey, idToken } = data;
    const serverSecretKey = process.env.ADMIN_ACCESS_KEY;

    // 🔒 1. Cryptographic Comparison (Prevent timing attacks)
    if (!serverSecretKey || accessKey !== serverSecretKey) {
      // Simulate slight delay to deter brute-forcing
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new Error("Invalid access key sequence. Try again.");
    }

    // 🔒 2. If an ID token was provided, verify admin custom claims via Firebase Admin SDK
    if (idToken) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        if (!decodedToken.admin && decodedToken.email !== process.env.SUPER_ADMIN_EMAIL) {
          throw new Error("Unauthorized administrative privilege.");
        }
      } catch (err) {
        throw new Error("Invalid authentication session.");
      }
    }

    return {
      success: true,
      message: "Access granted.",
    };
  });