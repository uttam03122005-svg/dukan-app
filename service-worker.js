const CACHE = 'dukan-v1';
const FILES = [
  './', './index.html', './owner.html', './user.html',
  './app.js', './style.css', './manifest.json'
];

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
});

self.addEventListener('fetch', e => {
  // GitHub raw data ko hamesha fresh fetch karo
  if (e.request.url.includes('raw.githubusercontent.com') ||
      e.request.url.includes('api.github.com') ||
      e.request.url.includes('api.imgbb.com')) {
    return; // network se hi jayega
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
