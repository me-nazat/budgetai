/**
 * Wealth AI — Service Worker (v4 Self-Healing & Resilient Recovery)
 *
 * Provides:
 * - App shell caching for offline support
 * - Self-healing offline and reconnection recovery
 * - Push notification handling
 * - Background sync placeholder
 *
 * Cache Strategy:
 * - Static assets: Stale-while-revalidate / cache-first (excluding /sw.js)
 * - API calls: Network-first, bypassing sensitive auth endpoints
 * - Navigation: Resilient network-first with automatic redirect follow, retry, and self-healing recovery
 */

const CACHE_NAME = 'wealth-ai-v4-self-healing';
const STATIC_ASSETS = [
  '/wealth-ai-logo-v2.png',
  '/manifest.json',
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connection Unavailable — Wealth AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0A0E1B;
      color: #FAFAFA;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: rgba(18, 24, 43, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 1.25rem;
      background: rgba(19, 109, 236, 0.12);
      border: 1px solid rgba(19, 109, 236, 0.25);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
    }
    .icon {
      width: 32px;
      height: 32px;
      fill: #136DEC;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
      color: #FFFFFF;
    }
    p {
      font-size: 0.875rem;
      color: #94A3B8;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .btn-primary {
      width: 100%;
      height: 48px;
      border-radius: 0.875rem;
      background: #136DEC;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 0.9375rem;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(19, 109, 236, 0.35);
      transition: background 0.15s, transform 0.08s;
    }
    .btn-primary:active { transform: scale(0.98); }
    .btn-secondary {
      width: 100%;
      height: 42px;
      border-radius: 0.875rem;
      background: transparent;
      color: #94A3B8;
      font-weight: 500;
      font-size: 0.8125rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      margin-top: 0.75rem;
      transition: color 0.15s, border-color 0.15s;
    }
    .btn-secondary:hover { color: #E2E8F0; border-color: rgba(255, 255, 255, 0.2); }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      font-size: 0.75rem;
      color: #CBD5E1;
      margin-bottom: 1rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #38BDF8;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-10h2v6h-2V7z"/>
      </svg>
    </div>
    <div class="status-pill">
      <span class="dot"></span>
      <span id="status-text">Reconnecting automatically...</span>
    </div>
    <h1>Connection Unavailable</h1>
    <p>Wealth AI is waiting for a secure connection or for network restoration.</p>
    <button class="btn-primary" onclick="window.location.reload()">
      Reconnect Now
    </button>
    <button class="btn-secondary" onclick="clearCacheAndReload()">
      Reset Service Cache & Refresh
    </button>
  </div>
  <script>
    window.addEventListener('online', function() { window.location.reload(); });
    let retries = 0;
    const interval = setInterval(function() {
      retries++;
      fetch('/manifest.json?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(function(res) {
          if (res.ok) {
            var st = document.getElementById('status-text');
            if (st) st.textContent = 'Connection restored! Reloading...';
            clearInterval(interval);
            window.location.reload();
          }
        })
        .catch(function() {});
      if (retries > 60) clearInterval(interval);
    }, 2000);

    function clearCacheAndReload() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          return Promise.all(regs.map(function(r) { return r.unregister(); }));
        }).then(function() {
          if ('caches' in window) {
            return caches.keys().then(function(keys) {
              return Promise.all(keys.map(function(k) { return caches.delete(k); }));
            });
          }
        }).then(function() {
          window.location.href = window.location.origin + '/?reset=' + Date.now();
        }).catch(function() {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }
  </script>
</body>
</html>`;

// ─── Install ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Purge all old caches (v1, v2, v3, etc.)
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      // Take control of all pages immediately
      await self.clients.claim();
      // Notify active client windows of successful activation
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_NAME });
      }
    })()
  );
});

// ─── Fetch Handler ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http(s) protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // CRITICAL: NEVER intercept or cache the service worker itself
  if (url.pathname === '/sw.js') return;

  // Bypass cache completely for auth, sessions, and export endpoints
  if (
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/export') ||
    url.pathname.startsWith('/api/import')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests (HTML documents): Resilient network-first with redirect follow and auto-retry
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt 1: Fetch with explicit follow mode for redirects (e.g. /dashboard -> /login)
          const response = await fetch(request.url, {
            method: 'GET',
            headers: request.headers,
            credentials: request.credentials || 'include',
            redirect: 'follow',
          });
          return response;
        } catch (firstErr) {
          // Attempt 2: Retry after a brief delay in case of network latency/cold-start
          try {
            await new Promise((resolve) => setTimeout(resolve, 300));
            const retryResponse = await fetch(request.url, {
              method: 'GET',
              headers: request.headers,
              credentials: request.credentials || 'include',
              redirect: 'follow',
            });
            return retryResponse;
          } catch (retryErr) {
            // Check cache for cached document if available
            const cached = await caches.match(request);
            if (cached) return cached;

            // Return self-healing offline recovery page with no-cache headers
            return new Response(OFFLINE_HTML, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
              },
            });
          }
        }
      })()
    );
    return;
  }

  // API calls: Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: Stale-while-revalidate / cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});

// ─── Messages ───
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'UNREGISTER') {
    self.registration.unregister().then(() => {
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => c.navigate(c.url));
      });
    });
  }
});

// ─── Push Notifications ───
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Wealth AI', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/wealth-ai-logo-v2.png',
    badge: '/wealth-ai-logo-v2.png',
    tag: data.tag || 'wealth-ai-notification',
    data: {
      url: data.url || '/dashboard',
    },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Wealth AI', options));
});

// ─── Notification Click ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if one is open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl);
      })
  );
});
