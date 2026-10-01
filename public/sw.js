const CACHE_NAME = 'ckblogistic-pwa-v2.6.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// Install Event - Pre-cache core shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately so new service worker takes effect across all devices
  self.skipWaiting();
});

// Activate Event - Clean up any stale caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging stale cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Anti-Error & Cross-Device Database Sync Protection
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Skip all non-GET requests (POST, PUT, DELETE, PATCH)
  if (req.method !== 'GET') return;

  // 2. CRITICAL DATABASE & SYNC PROTECTION:
  // NEVER intercept cross-origin requests to Supabase, Cloudflare Workers, Google APIs, or external DBs.
  // By returning without calling event.respondWith, browser performs them natively
  // ensuring CORS headers, Bearer tokens, apikey, and WebSockets are NEVER blocked or altered.
  if (url.origin !== self.location.origin) {
    const isCdnAsset = 
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com');

    if (!isCdnAsset) {
      // BYPASS COMPLETELY (Direct Native Network)
      return;
    }

    // For external font/CDN static assets, serve from cache with network fallback
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return networkRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. CRITICAL SAME-ORIGIN BYPASS:
  // NEVER intercept API endpoints, version checks, or Vite development modules
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/version.json' ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('.vite') ||
    url.search.includes('v=') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx')
  ) {
    return;
  }

  // 4. Navigation requests (HTML page)
  // Network-First: Always fetch latest index.html so devices get newest code immediately; fallback to cache if offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || new Response('Offline - LogistikApps Hub', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 5. Same-origin Static Assets (JS bundles, CSS, Images, Icons)
  // Network-First: Fetch from network first so code updates take effect immediately on all devices
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});

// Listen for message events (e.g. skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({
      type: 'VERSION_RESPONSE',
      cacheName: CACHE_NAME,
      version: '2.6.0'
    });
  }
});

// Push Notification Event (Background Web Push)
self.addEventListener('push', (event) => {
  let data = { title: '📢 Pesan Siaran Pos Logistik', message: 'Ada siaran informasi baru.', category: 'info' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.message = event.data.text();
  }

  const options = {
    body: data.message || data.content || 'Ada pesan siaran baru.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [300, 150, 300, 150, 450],
    tag: 'ckb-broadcast-push',
    renotify: true,
    requireInteraction: true,
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📢 Pesan Siaran Baru', options)
  );
});

// Notification Click Event - Bring existing tab/app window into focus
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
