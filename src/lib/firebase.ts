/**
 * Firebase messaging, database, and subscription module.
 * Ensure you install the SDK first: bun add firebase
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD45WuPr0HR9d0lJY4HCrhRUhy-kV0wsw4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "messmenu-a387b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "messmenu-a387b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "messmenu-a387b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1057632756638",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1057632756638:web:8eca944e315ec5c76c2c8f"
};

// Check if configuration exists safely
export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey);

// Safely initialize app avoiding multi-instance errors, running exclusively on client-side window environment
const app = typeof window !== "undefined" && isFirebaseConfigured()
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

// EXPORTED DATABASE MEMBER
export const db = app ? getFirestore(app) : null;

/**
 * Requests native browser/device notification permissions
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

/**
 * Retrieves the FCM device token using the active service worker and syncs subscription with the backend
 */
export async function subscribeToMessTopic(messId: string): Promise<void> {
  if (!isFirebaseConfigured() || !app) {
    console.info("[FCM] Firebase not configured. Would subscribe to topic:", messId);
    return;
  }

  try {
    // Dynamic import to prevent Node/SSR build environment crashes
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);

    // Ensure the service worker is active and ready before requesting the FCM token
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;

    // ⚡ FALLBACK HOOK: Paste the exact string generated from your screen here!
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BFMy8PUCrFHB6PHZbiZCm31sHnkCpKExaz9AlWetQ7MmV_70KrYWd5de_ziOxi3Yfeh1Sw6nZTStVer6omiRFbY";

    if (!vapidKey || vapidKey === "BFMy8PUCrFHB6PHZbiZCm31sHnkCpKExaz9AlWetQ7MmV_70KrYWd5de_ziOxi3Yfeh1Sw6nZTStVer6omiRFbY") {
      console.warn("[FCM] Missing active VAPID key pair configuration values.");
    }

    // Retrieve unique browser notification routing device token
    const token = await getToken(messaging, {
      serviceWorkerRegistration,
      vapidKey: vapidKey
    });

    if (!token) {
      console.warn("[FCM] No token instance returned. Verify browser permission policies.");
      return;
    }

    console.info(`[FCM] Token generated. Syncing topic registration for: mess_${messId}`);

    // Call internal backend proxy endpoint to let Firebase Admin handle topic subscription safely
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        topic: `mess_${messId}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server tracking returned status code ${response.status}`);
    }

    console.info(`[FCM] Successfully subscribed to mess_${messId}`);
  } catch (error) {
    console.error("[FCM] Error processing subscription sequence:", error);
    throw error;
  }
}