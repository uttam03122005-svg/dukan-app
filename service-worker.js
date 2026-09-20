const CACHE = 'dukan-v2';
const FILES = [
  './', './index.html', './owner.html', './user.html',
  './app.js', './style.css', './manifest.json'
];

// Firebase config - secret.json se same rakho
// ⚠️ Yahan apni Firebase config paste karo (same as secret.json)
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Load Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize only if config looks valid
if (FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_')) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(payload => {
      console.log('🔔 Background message:', payload);

      const title = (payload.notification && payload.notification.title) || '🛒 Naya Order!';
      const body = (payload.notification && payload.notification.body) || 'Dukan par naya order aaya hai';

      const options = {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'dukan-order-' + ((payload.data && payload.data.order_id) || Date.now()),
        renotify: true,
        requireInteraction: true,
        data: payload.data || {},
        actions: [
          { action: 'view', title: '📦 Order Dekho' },
          { action: 'dismiss', title: '❌ Band' }
        ]
      };

      return self.registration.showNotification(title, options);
    });
  } catch (e) {
    console.warn('FCM SW init fail:', e);
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('owner.html') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('./owner.html');
    })
  );
});

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Network-first for dynamic content
  if (url.includes('raw.githubusercontent.com') ||
      url.includes('api.github.com') ||
      url.includes('api.imgbb.com') ||
      url.includes('googleapis.com') ||
      url.includes('firebase') ||
      url.includes('qrserver.com')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
