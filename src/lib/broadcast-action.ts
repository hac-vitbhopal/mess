"use server" // ⚡ CRUCIAL: Tells the bundler this file runs strictly on the Node.js server side

import { createServerFn } from '@tanstack/react-start'

// We dynamically import firebase-admin ONLY when the handler runs on the server.
// This prevents the browser compilation layer from crashing on startup.
export const sendFcmNotification = createServerFn({ method: 'POST' })
  .validator((data: { topic: string; title: string; body: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Dynamically load the server-only admin modules safely inside the runtime block
      const { getApps, initializeApp, cert } = await import('firebase-admin/app')
      const { getMessaging } = await import('firebase-admin/messaging')

      if (getApps().length === 0) {
        initializeApp({
          credential: cert({
            projectId: "messmenu-a387b",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
          }),
        });
      }

      const message = {
  // ⚡ CHANGE: Put the properties inside 'data' and remove the top-level 'notification' object completely!
  // This tells Firebase to hand the raw packet straight to your sw.js worker to process manually.
  data: {
    title: data.title,
    body: data.body,
    url: "/",
    tag: "meal-alert",
  },
  topic: data.topic,
};

      const response = await getMessaging().send(message);
      return { success: true, messageId: response };
    } catch (error: any) {
      console.error("FCM Backend Action Error:", error);
      return { success: false, error: error.message };
    }
  });