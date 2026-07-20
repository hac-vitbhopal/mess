import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { registerFcmToken } from "./register-token-action";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

const app =
  typeof window !== "undefined" && isFirebaseConfigured()
    ? getApps().length
      ? getApp()
      : initializeApp(firebaseConfig)
    : null;

export const db = app ? getFirestore(app) : null;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export async function subscribeToMessTopic(messId: string) {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return;

    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    const messaging = getMessaging(app!);

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return;

    await registerFcmToken({
      data: { token, messId },
    });

    onMessage(messaging, (payload) => {
      new Notification(
        payload.data?.title || payload.notification?.title || "MessHub",
        {
          body: payload.data?.body || payload.notification?.body || "",
          icon: "/menu_logo.png",
        }
      );
    });
  } catch {
    // Silent catch in production
  }
}