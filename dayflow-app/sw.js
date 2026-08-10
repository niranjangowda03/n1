// sw.js — caches the app shell so DayFlow's UI still opens offline.
// This does NOT provide push notifications (that needs a server); it only
// makes the already-open app resilient to lost connectivity, per the
// "Offline Support" requirement (core screens keep working without a network).

const CACHE = 'dayflow-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/router.js',
  './js/utils.js',
  './js/theme.js',
  './js/notifications.js',
  './js/recurrence.js',
  './js/views/dashboard.js',
  './js/views/timetable.js',
  './js/views/calendar.js',
  './js/views/notes.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './js/views/search.js',
  './js/views/notificationCenter.js',
  './js/components/taskModal.js',
  './js/components/quickReminder.js',
  './js/components/onboarding.js',
  './js/components/planningAssistant.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
