// public/sw.js

// 1. Import Firebase Compatibility Scripts inside the worker context
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Initialize Firebase using the exact credentials from your app config
firebase.initializeApp({
  apiKey: "AIzaSyD45WuPr0HR9d0lJY4HCrhRUhy-kV0wsw4",
  authDomain: "messmenu-a387b.firebaseapp.com",
  projectId: "messmenu-a387b",
  storageBucket: "messmenu-a387b.firebasestorage.app",
  messagingSenderId: "1057632756638",
  appId: "1:1057632756638:web:8eca944e315ec5c76c2c8f"
});

const messaging = firebase.messaging();

// 3. Let Firebase handle incoming background message payloads safely
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message intercepted: ', payload);

  // ⚡ FIX: Extract parameters natively out of the updated data string attributes
  const title = payload.data?.title || "📢 MessHub Alert";
  const options = {
    body: payload.data?.body || "New menu updates are available.",
    icon: "/mess_logo.png",
    badge: "/mess_logo.png",
    tag: payload.data?.tag || 'meal-alert',
    renotify: true,
    requireInteraction: true, 
    vibrate: [300, 100, 300],
    data: { url: payload.data?.url || "/" }
  };

  self.registration.showNotification(title, options);
});

// 4. Handle notification tray tap interactions
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Dismiss it from the tray

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});