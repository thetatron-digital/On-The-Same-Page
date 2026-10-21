// OTSP offline support: keep the app's own files so it opens without a
// connection (on set, in a basement, on a plane). Projects already live in
// the browser; Drive sync catches up when the connection returns.
// - Page loads: network first, falling back to the last copy
// - Built assets (/assets/*, hashed): cache first, they never change
// - Everything else (Google APIs, other sites): left alone
const CACHE = 'otsp-app-v3';
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest'];

// Every built file (all apps), from the build's manifest, so apps that
// haven't been opened yet also work offline
async function allAssets() {
  try {
    const res = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const manifest = await res.json();
    const files = new Set();
    for (const entry of Object.values(manifest)) {
      if (entry.file) files.add(`/${entry.file}`);
      for (const css of entry.css || []) files.add(`/${css}`);
      for (const asset of entry.assets || []) files.add(`/${asset}`);
    }
    return [...files];
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Best effort: a missing file mustn't stop the install
    await Promise.all((await allAssets()).map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('otsp-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page sends the files it loaded before this worker took over
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return;
  const urls = (event.data.urls || []).filter((u) => {
    try { const url = new URL(u); return url.origin === self.location.origin && url.pathname.startsWith('/assets/'); } catch { return false; }
  });
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(urls)).catch(() => {}));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Any app URL (/projects/…/basecamp) is the same single page
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html', { ignoreVary: true }).then((r) => r || caches.match('/', { ignoreVary: true })))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      // ignoreVary: module scripts send an Origin header the cached copy didn't
      caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
