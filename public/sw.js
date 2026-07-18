// public/sw.js

// Keep your existing installation or caching event listeners above this if you have any!

self.addEventListener('notificationclick', function(event) {
  // Instantly dim and dismiss the notification panel card from the screen
  event.notification.close(); 

  // Force the browser shell instance to wake up and focus the MessHub tab window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if a tab of our app is already open somewhere in the browser background
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        // Safer check: checks if the window is on our current app origin root
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // If the app isn't open anywhere, spin open a fresh window instances tab
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});