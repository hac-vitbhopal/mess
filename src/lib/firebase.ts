/**
 * Firebase scaffolding (prepared, not connected).
 *
 * To enable: create a Firebase project, fill in env vars in .env.local:
 *   VITE_FIREBASE_API_KEY=
 *   VITE_FIREBASE_AUTH_DOMAIN=
 *   VITE_FIREBASE_PROJECT_ID=
 *   VITE_FIREBASE_STORAGE_BUCKET=
 *   VITE_FIREBASE_MESSAGING_SENDER_ID=
 *   VITE_FIREBASE_APP_ID=
 *   VITE_FIREBASE_VAPID_KEY=
 *
 * Then install: bun add firebase
 * And uncomment the code below.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey);

// Placeholder: subscribe a device to a mess topic via FCM.
// Real implementation registers the SW, gets a token, and calls backend to subscribe.
export async function subscribeToMessTopic(messId: string) {
  if (!isFirebaseConfigured()) {
    console.info("[FCM] Firebase not configured. Would subscribe to topic:", messId);
    return;
  }
  // const { getMessaging, getToken } = await import("firebase/messaging");
  // ... token retrieval + backend subscribe
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}
