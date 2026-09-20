const CACHE = 'dukan-v4';
const FILES = [
  './', './index.html', './owner.html', './user.html',
  './app.js', './style.css', './manifest.json'
];

// Firebase config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCxH3hhM0L3VWWqBThR7qWBaUrH3a5_u0s",
  authDomain: "dukan-app-2dba2.firebaseapp.com",
  projectId: "dukan-app-2dba2",
  storageBucket: "dukan-app-2dba2.firebasestorage.app",
  messagingSenderId: "184052572948",
  appId: "1:184052572948:web:3eef9299b1015677f0d801"
};

// Load Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase & FCM
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    console.log('🔔 Background message:', payload);
    const title = (payload.notification && payload.notification.title) || '🛒 Naya Order Aaya!';
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
  console.log('✅ FCM Service Worker ready');
} catch (e) {
  console.warn('⚠️ FCM SW init fail:', e);
}

// Notification click
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
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Network-first for API calls
  if (url.includes('googleapis.com') ||
      url.includes('firebase') ||
      url.includes('imgbb.com') ||
      url.includes('qrserver.com') ||
      url.includes('raw.githubusercontent.com')) {
    return;
  }
  // Cache-first for static
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
