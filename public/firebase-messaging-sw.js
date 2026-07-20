// public/firebase-messaging-sw.js

// 1. Import Firebase Compatibility Scripts inside the worker context
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Initialize Firebase using exact credentials
firebase.initializeApp({
  apiKey: "AIzaSyD45WuPr0HR9d0lJY4HCrhRUhy-kV0wsw4",
  authDomain: "messmenu-a387b.firebaseapp.com",
  projectId: "messmenu-a387b",
  storageBucket: "messmenu-a387b.firebasestorage.app",
  messagingSenderId: "1057632756638",
  appId: "1:1057632756638:web:8eca944e315ec5c76c2c8f"
});

const messaging = firebase.messaging();

// 3. Handle incoming background message payloads safely
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message intercepted: ', payload);

  // ⚡ FIX: Fallback gracefully across notification and data objects
  const title = payload.notification?.title || payload.data?.title || "📢 MessHub Alert";
  const body = payload.notification?.body || payload.data?.body || "New menu updates are available.";

  // ⚡ Ensure this filename matches your exact file in /public directory (menu_logo.png)
  const iconPath = "/menu_logo.png"; 

  const options = {
    body: body,
    icon: iconPath,
    badge: iconPath,
    tag: payload.data?.tag || 'meal-alert',
    renotify: true,
    requireInteraction: true, 
    vibrate: [300, 100, 300],
    data: { 
      url: payload.data?.url || "/",
      messId: payload.data?.messId
    }
  };

  self.registration.showNotification(title, options);
});

// 4. Handle notification tray tap interactions
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Dismiss from system tray

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