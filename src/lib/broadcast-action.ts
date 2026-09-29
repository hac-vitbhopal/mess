"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb, adminMessaging, adminAuth } from "./firebase-admin";

interface NotificationPayload {
  topic: string;
  title: string;
  body: string;
  url?: string;
  adminToken: string; // 🔒 Required secure operator token check
}

export const sendFcmNotification = createServerFn({
  method: "POST",
})
  .validator((data: NotificationPayload) => {
    // 🔒 CRITICAL SECURITY CHECK: Ensure token and payload parameters exist
    if (!data.topic || !data.title || !data.body || !data.adminToken) {
      throw new Error("Missing required notification parameters or administrative credentials.");
    }

    // Validate URL safety to prevent open-redirect phishing primitives
    let safeUrl = "/";
    if (data.url && typeof data.url === "string") {
      const trimmed = data.url.trim();
      if (trimmed === "/" || trimmed.startsWith("/")) {
        safeUrl = trimmed;
      } else if (trimmed.startsWith("https://")) {
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
      adminToken: data.adminToken,
    };
  })
  .handler(async ({ data }) => {
    let { topic, title, body, url, adminToken } = data;

    try {
      // 🔒 1. CRYPTOGRAPHIC AUTHENTICATION & RBAC VERIFICATION
      try {
        const decodedToken = await adminAuth.verifyIdToken(adminToken);
        if (!decodedToken.admin) {
          throw new Error("Unauthorized: Operator lacks administrative privileges.");
        }
      } catch (authErr) {
        throw new Error("Authentication failed: Invalid or expired operator token.");
      }

      const messId = topic.replace("mess_", "");

      // ⚡ FALLBACK SAFEGUARD: If body is generic, dynamically pull today's menu from Firestore
      if ((body.includes("Check out today's selections") || body.includes("is Live!")) && messId !== "all") {
        try {
          const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
          const menuDoc = await adminDb.collection("menus").doc(`${messId}_${todayStr}`).get();
          if (menuDoc.exists) {
            const menuData = menuDoc.data();
            const mealKey = title.toLowerCase().includes("breakfast") ? "breakfast" : 
                            title.toLowerCase().includes("lunch") ? "lunch" : 
                            title.toLowerCase().includes("dinner") ? "dinner" : "snacks";
            const items = menuData?.[mealKey] || menuData?.items;
            if (Array.isArray(items) && items.length > 0) {
              body = `Today's items: ${items.join(", ")}`;
            } else if (typeof items === "string" && items.trim()) {
              body = `Today's items: ${items}`;
            }
          }
        } catch (menuErr) {
          console.error("[Menu Fallback Error]:", menuErr);
        }
      }

      // 1. SAVE BROADCAST DOCUMENT TO FIRESTORE FIRST (Audit Trail)
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
        query = adminDb.collection("fcm_tokens").limit(5000);
      } else {
        query = adminDb
          .collection("fcm_tokens")
          .where("messId", "==", messId)
          .limit(2000);
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
        if (typeof docData.token === "string") {
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