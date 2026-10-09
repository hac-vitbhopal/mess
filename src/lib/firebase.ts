import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // ⚡ Added for Google Sign-In
import { getAnalytics } from "firebase/analytics"; // 📊 Added for Google Analytics
import { registerFcmToken } from "./register-token-action";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

// Ensure clean single-instance initialization
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

const app = getFirebaseApp();
export const db = app ? getFirestore(app) : null;

// ⚡ AUTH & GOOGLE PROVIDER EXPORTS (Required for Student Login)
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

// 📊 ANALYTICS EXPORT (Safe client-side initialization)
export const analytics = app && typeof window !== "undefined" ? getAnalytics(app) : null;

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.error("[FCM] Notifications not supported.");
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return await Notification.requestPermission();
}

export async function subscribeToMessTopic(messId: string, name?: string, email?: string) {
  try {
    const activeApp = getFirebaseApp();
    if (!activeApp) {
      console.error("[FCM] Firebase App instance is not initialized.");
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Notification permission was not granted.");
      return;
    }

    console.log("[FCM] Importing messaging...");
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");

    const messaging = getMessaging(activeApp);

    console.log("[FCM] Registering service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    console.log("[FCM] Service worker ready.");

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error("Missing VITE_FIREBASE_VAPID_KEY in environment variables.");
    }

    console.log("[FCM] Getting token...");
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.error("[FCM] Token generation failed.");
      return;
    }

    console.log("[FCM] Generated Token:", token);

    // Call server action with matching payload schema
    try {
      const res = await registerFcmToken({
        data: {
          token,
          messId,
          name: name || null,
          email: email || null,
        },
      });

      if (res?.success) {
        console.log("[FCM] Token registered and subscribed successfully.");
      } else {
        console.warn("[FCM] Server token registration reported:", res?.error);
      }
    } catch (serverErr) {
      console.warn("[FCM] Server registration skipped/failed:", serverErr);
    }

    // Set up foreground message listener
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message received:", payload);

      if (Notification.permission === "granted") {
        new Notification(
          payload.data?.title || payload.notification?.title || "MessHub",
          {
            body: payload.data?.body || payload.notification?.body || "",
            icon: "/mess_logo.png",
          }
        );
      }
    });
  } catch (err) {
    console.error("[FCM] Subscription error:", err);
  }
}