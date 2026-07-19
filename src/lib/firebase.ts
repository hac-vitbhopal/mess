// /**
//  * Firebase messaging, database, and subscription module.
//  * Ensure you install the SDK first: bun add firebase
//  */
// import { initializeApp, getApps, getApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";

// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD45WuPr0HR9d0lJY4HCrhRUhy-kV0wsw4",
//   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "messmenu-a387b.firebaseapp.com",
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "messmenu-a387b",
//   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "messmenu-a387b.firebasestorage.app",
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1057632756638",
//   appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1057632756638:web:8eca944e315ec5c76c2c8f"
// };

// // Check if configuration exists safely
// export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey);

// // Safely initialize app avoiding multi-instance errors, running exclusively on client-side window environment
// const app = typeof window !== "undefined" && isFirebaseConfigured()
//   ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
//   : null;

// // EXPORTED DATABASE MEMBER
// export const db = app ? getFirestore(app) : null;

// /**
//  * Requests native browser/device notification permissions
//  */
// export async function requestNotificationPermission(): Promise<NotificationPermission> {
//   if (typeof Notification === "undefined") return "denied";
//   if (Notification.permission === "granted" || Notification.permission === "denied") {
//     return Notification.permission;
//   }
//   return Notification.requestPermission();
// }

// /**
//  * Retrieves the FCM device token using the active service worker and syncs subscription with the backend
//  */
// export async function subscribeToMessTopic(messId: string): Promise<void> {
//   if (!isFirebaseConfigured() || !app) {
//     console.info("[FCM] Firebase not configured. Would subscribe to topic:", messId);
//     return;
//   }

//   try {
//     // Dynamic import to prevent Node/SSR build environment crashes
//     const { getMessaging, getToken } = await import("firebase/messaging");
//     const messaging = getMessaging(app);

//     console.info("[FCM] Registering Firebase messaging service worker...");

//     // 1. Register the service worker file first
//     await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

//     // 2. ⚡ FORCE the script to wait until the worker is fully active and awake!
//     const serviceWorkerRegistration = await navigator.serviceWorker.ready;

//     // The active VAPID credentials key
//     const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BFMy8PUCrFHB6PHZbiZCm31sHnkCpKExaz9AlWetQ7MmV_70KrYWd5de_ziOxi3Yfeh1Sw6nZTStVer6omiRFbY";

//     if (!vapidKey || vapidKey === "BFMy8PUCrFHB6PHZbiZCm31sHnkCpKExaz9AlWetQ7MmV_70KrYWd5de_ziOxi3Yfeh1Sw6nZTStVer6omiRFbY") {
//       console.warn("[FCM] Missing active VAPID key pair configuration values.");
//     }

//     // 3. Securely grab the routing token now that the worker registry is fully ready
//     const token = await getToken(messaging, {
//       serviceWorkerRegistration,
//       vapidKey: vapidKey
//     });

//     if (!token) {
//       console.warn("[FCM] No token instance returned. Verify browser permission policies.");
//       return;
//     }

//     console.info(`[FCM] Token generated. Syncing topic registration for: mess_${messId}`);

//     // 4. Send it down to your internal database route handler
//     const response = await fetch("/api/subscribe", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         token,
//         topic: `mess_${messId}`,
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`Server tracking returned status code ${response.status}`);
//     }

//     console.info(`[FCM] Successfully subscribed to mess_${messId}`);
//   } catch (error) {
//     console.error("[FCM] Error processing subscription sequence:", error);
//     throw error;
//   }
// }

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { registerFcmToken } from "./register-token-action";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD45WuPr0HR9d0lJY4HCrhRUhy-kV0wsw4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "messmenu-a387b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "messmenu-a387b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "messmenu-a387b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1057632756638",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1057632756638:web:8eca944e315ec5c76c2c8f"
};

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

const app =
  typeof window !== "undefined" && isFirebaseConfigured()
    ? getApps().length
      ? getApp()
      : initializeApp(firebaseConfig)
    : null;

export const db = app ? getFirestore(app) : null;

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.error("[FCM] Notifications not supported.");
    return "denied";
  }

  console.log("[FCM] Current permission:", Notification.permission);

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    console.warn("[FCM] Permission already denied.");
    return "denied";
  }

  const permission = await Notification.requestPermission();

  console.log("[FCM] Permission result:", permission);

  return permission;
}

export async function subscribeToMessTopic(messId: string) {
  try {
    const permission = await requestNotificationPermission();

    if (permission !== "granted") {
      console.error("[FCM] Cannot continue without permission.");
      return;
    }

    console.log("[FCM] Importing messaging...");

    const { getMessaging, getToken, onMessage } = await import(
      "firebase/messaging"
    );

    const messaging = getMessaging(app!);

    console.log("[FCM] Registering service worker...");

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    console.log("[FCM] Registered:", registration);

    await navigator.serviceWorker.ready;

    console.log("[FCM] Service worker ready.");

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

if (!vapidKey) {
  throw new Error("Missing VITE_FIREBASE_VAPID_KEY");
}
console.log("Using VAPID key:", vapidKey);
console.log("Length:", vapidKey.length);
    console.log("[FCM] Getting token...");



 let token: string | undefined;

try {
  token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  console.log("FCM Token:", token);
} catch (err) {
  console.error("getToken failed:", err);
  return;
}

if (!token) {
  console.error("[FCM] Token generation failed.");
  return;
}

// const response = await fetch("/api/-register-token", {
//     method: "POST",
//     headers: {
//         "Content-Type": "application/json"
//     },
//     body: JSON.stringify({
//         token,
//         messId
//     })
// });
//     console.log("[FCM] Subscribe status:", response.status);

//     if (!response.ok) {
//       console.error(await response.text());
//     } else {
//       console.log("[FCM] Successfully subscribed.");
//     }
try {
  await registerFcmToken({
    data: {
      token,
      messId,
    },
  });

  console.log("[FCM] Token successfully saved to Firestore.");
} catch (err) {
  console.error("[FCM] Failed to save token:", err);
  return;
}
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);

      new Notification(
        payload.data?.title || payload.notification?.title || "MessHub",
        {
          body:
            payload.data?.body ||
            payload.notification?.body ||
            "",
            icon: "/mess_logo.png",
        }
      );
    });
  } catch (err) {
    console.error("[FCM] Fatal Error:", err);
  }
}