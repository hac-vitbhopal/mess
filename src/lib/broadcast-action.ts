"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb, adminMessaging } from "./firebase-admin";

interface NotificationPayload {
  topic: string;
  title: string;
  body: string;
}

export const sendFcmNotification = createServerFn({
  method: "POST",
})
  .validator((data: NotificationPayload) => data)
  .handler(async ({ data }) => {
    const { topic, title, body } = data;

    try {
      const messId = topic.replace("mess_", "");
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
          success: false,
          message: "No registered devices found.",
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

      console.log(`Found ${devices.length} registered devices.`);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < devices.length; i += 500) {
        const batch = devices.slice(i, i + 500);

        const response = await adminMessaging.sendEachForMulticast({
          tokens: batch.map((d) => d.token),

          // 1. Explicit System Banner (Required for closed PWA)
          notification: {
            title,
            body,
          },

          // 2. Custom Payload for Service Worker & Click Handling
          data: {
            title,
            body,
            url: "/",
            tag: "meal-alert",
          },

          // 3. WebPush Configuration for Browser Engines
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
              link: "/",
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