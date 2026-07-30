"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb, adminMessaging } from "./firebase-admin";

interface NotificationPayload {
  topic: string;
  title: string;
  body: string;
  url?: string;
}

export const sendFcmNotification = createServerFn({
  method: "POST",
})
  .validator((data: NotificationPayload) => data)
  .handler(async ({ data }) => {
    // ⚡ FIX: Extract url dynamically with a default fallback to "/"
    const { topic, title, body, url = "/" } = data;

    try {
      const messId = topic.replace("mess_", "");

      // 1. SAVE BROADCAST DOCUMENT TO FIRESTORE FIRST
      await adminDb.collection("broadcasts").add({
        title,
        body,
        messId,
        topic,
        url, // ⚡ Save target URL to database as well
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

          // Explicit System Banner (Required for closed PWA/Browser)
          notification: {
            title,
            body,
          },

          // Custom Payload for Service Worker & Foreground/Background
          data: {
            title,
            body,
            messId,
            url, // ⚡ FIX: Replaced hardcoded "/" with dynamic url variable
            tag: "meal-alert",
          },

          // WebPush Configuration
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
              link: url, // ⚡ FIX: Replaced hardcoded "/" with dynamic url variable
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
      return {
        success: false,
        error: err.message,
      };
    }
  });