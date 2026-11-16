const CACHE = 'becs-offline-v1'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/becs-offline.html')))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  // Never cache authenticated pages, API responses, or private behavior data.
  if (url.origin !== self.location.origin || event.request.mode !== 'navigate' || !/^\/(control(?:\/|$)|focus(?:\/|$)|tap\/)/.test(url.pathname)) return
  event.respondWith(fetch(event.request).catch(() => caches.match('/becs-offline.html')))
})
