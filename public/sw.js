// public/sw.js

// 1. Listen for background push events from Firebase Cloud Messaging
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.notification?.title || "📢 MessHub Alert";
    const options = {
      body: payload.notification?.body || "New menu updates are available.",
      icon: "/mess_logo.png",
      badge: "/mess_logo.png",
      tag: payload.data?.tag || 'generic-broadcast',
      renotify: true,
      requireInteraction: true, // ⚡ Holds it permanently in the notification tray until swiped
      vibrate: [300, 100, 300],
      data: { url: payload.data?.url || "/" }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Fallback if data string is plain text instead of json object
    const textOptions = {
      body: event.data.text(),
      icon: "/mess_logo.png",
      badge: "/mess_logo.png",
      requireInteraction: true,
      vibrate: [300, 100, 300]
    };
    event.waitUntil(self.registration.showNotification("📢 MessHub Broadcast", textOptions));
  }
});

// 2. Handle what happens when a student taps the system tray card panel
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Automatically dismiss from system tray on click

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a fresh window view channel
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});