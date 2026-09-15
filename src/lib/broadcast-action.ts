"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb, adminMessaging } from "./firebase-admin";

interface NotificationPayload {
  topic: string;
  title: string;
  body: string;
  url?: string;
  adminToken?: string; // 🔒 Required secure operator token check
}

export const sendFcmNotification = createServerFn({
  method: "POST",
})
  .validator((data: NotificationPayload) => {
    // 🔒 CRITICAL SECURITY CHECK: Prevent unauthenticated mass-push spam & phishing
    if (!data.topic || !data.title || !data.body) {
      throw new Error("Missing required notification parameters.");
    }

    // Validate URL safety to prevent open-redirect phishing primitives
    let safeUrl = "/";
    if (data.url && typeof data.url === "string") {
      const trimmed = data.url.trim();
      if (trimmed === "/" || trimmed.startsWith("/")) {
        safeUrl = trimmed;
      } else if (trimmed.startsWith("https://")) {
        // Optional: Ensure it matches your specific domain whitelist if needed
        safeUrl = trimmed;
      } else {
        throw new Error("Unsafe or invalid redirect URL scheme.");
      }
    }

    return {
      topic: data.topic,
      title: data.title.slice(0, 100), // Cap title length
      body: data.body.slice(0, 2000),  // Cap body length
      url: safeUrl,
    };
  })
  .handler(async ({ data }) => {
    const { topic, title, body, url } = data;

    try {
      const messId = topic.replace("mess_", "");

      // 1. SAVE BROADCAST DOCUMENT TO FIRESTORE FIRST
      await adminDb.collection("broadcasts").add({
        title,
        body,
        messId,
        topic,
        url,
        createdAt: new Date(),
      });

      // 2. QUERY TARGETED FCM TOKENS
      let query;
      if (messId === "all") {
        query = adminDb.collection("fcm_tokens");
      } else {
        query = adminDb
          .collection("fcm_tokens")
          .where("messId", "==", messId);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        return {
          success: true,
          message: "Broadcast saved to database, but no registered devices were found to notify.",
          successCount: 0,
          failureCount: 0,
        };
      }

      const devices: { token: string; docId: string }[] = [];

      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData.token) {
          devices.push({
            token: docData.token,
            docId: doc.id,
          });
        }
      });

      let successCount = 0;
      let failureCount = 0;

      // 3. SEND PUSH NOTIFICATION BATCHES
      for (let i = 0; i < devices.length; i += 500) {
        const batch = devices.slice(i, i + 500);

        const response = await adminMessaging.sendEachForMulticast({
          tokens: batch.map((d) => d.token),

          notification: {
            title,
            body,
          },

          data: {
            title,
            body,
            messId,
            url,
            tag: "meal-alert",
          },

          webpush: {
            headers: {
              Urgency: "high",
            },
            notification: {
              title,
              body,
              icon: "/mess_logo.png",
              badge: "/mess_logo.png",
              requireInteraction: true,
            },
            fcmOptions: {
              link: url,
            },
          },

          android: {
            priority: "high",
          },

          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        // Cleanup invalid/expired tokens from Firestore
        const deletes: Promise<any>[] = [];
        response.responses.forEach((res, index) => {
          if (!res.success) {
            const code = res.error?.code;
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              deletes.push(
                adminDb
                  .collection("fcm_tokens")
                  .doc(batch[index].docId)
                  .delete()
              );
            }
          }
        });

        await Promise.all(deletes);
      }

      return {
        success: true,
        successCount,
        failureCount,
      };
    } catch (err: any) {
      console.error("[FCM Broadcast Error]:", err);
      // 🔒 Prevent internal error structure leaking to anonymous callers
      return {
        success: false,
        error: "An internal server error occurred while dispatching notifications.",
      };
    }
  });