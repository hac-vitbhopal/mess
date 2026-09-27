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
export const analytics = (app && typeof window !== "undefined") ? getAnalytics(app) : null;

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.error("[FCM] Notifications not supported.");
    return "denied";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return await Notification.requestPermission();
}

export async function subscribeToMessTopic(messId: string, name?: string) {
  try {
    const activeApp = getFirebaseApp();
    if (!activeApp) {
      console.error("[FCM] Firebase App instance is not initialized.");
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      console.error("[FCM] Cannot continue without permission.");
      return;
    }

    console.log("[FCM] Importing messaging...");

    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    
    // Safely retrieve messaging instance from activeApp
    const messaging = getMessaging(activeApp);

    console.log("[FCM] Registering service worker...");

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    console.log("[FCM] Service worker ready.");

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error("Missing VITE_FIREBASE_VAPID_KEY");
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

    console.log("FCM Token:", token);

    // Save token, messId, and name to Firestore
    await registerFcmToken({
      data: {
        token,
        messId,
        name,
      },
    });

    console.log("[FCM] Token and profile successfully saved to Firestore.");

    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);

      new Notification(
        payload.data?.title || payload.notification?.title || "MessHub",
        {
          body: payload.data?.body || payload.notification?.body || "",
          icon: "/mess_logo.png",
        }
      );
    });
  } catch (err) {
    console.error("[FCM] Fatal Error:", err);
  }
}