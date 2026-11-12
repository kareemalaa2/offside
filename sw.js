// Service worker: makes the app open and work with no internet.
// Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'offside-v1.0.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './src/main.js',
  './src/core/utils.js',
  './src/core/labels.js',
  './src/data/defaults.js',
  './src/data/migrations.js',
  './src/data/storage.js',
  './src/domain/pricing.js',
  './src/domain/period.js',
  './src/domain/inventory.js',
  './src/domain/cash.js',
  './src/domain/customers.js',
  './src/application/store.js',
  './src/application/services/index.js',
  './src/application/services/sessions.js',
  './src/application/services/commerce.js',
  './src/application/services/cashbox.js',
  './src/application/services/people.js',
  './src/application/services/admin.js',
  './src/presentation/context.js',
  './src/presentation/ui.js',
  './src/presentation/auth.js',
  './src/presentation/components.js',
  './src/presentation/app.js',
  './src/presentation/views/sessionDialogs.js',
  './src/presentation/views/home.js',
  './src/presentation/views/log.js',
  './src/presentation/views/accounts.js',
  './src/presentation/views/settings.js',
  './src/presentation/views/inventory.js',
  './src/presentation/views/reports.js',
  './src/presentation/views/closing.js',
  './src/presentation/views/bookings.js',
  './src/presentation/views/customers.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer instantly from cache, refresh in the background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});
