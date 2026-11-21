/* Bharosa service worker: app shell + voice prompts cached for use with NO signal.
   Strategy: static assets/audio = cache-first; API GETs = network-first with cache fallback; POSTs are never cached
   (the app's own outbox handles offline writes with idempotency keys). */
const VERSION = 'bharosa-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  const isAudio = url.pathname.includes('/audio/') || url.pathname.endsWith('.mp3')
  const isApi = !sameOrigin || url.pathname.startsWith('/api')
  if (isAudio || (sameOrigin && /\.(js|css|svg|png|woff2?)$/.test(url.pathname))) {
    e.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res }).catch(() => hit)
      )
    )
    return
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return r }).catch(() => caches.match('/')))
    return
  }
  if (isApi) {
    e.respondWith(
      fetch(req).then((res) => { if (res.ok && !/auth|audit/.test(url.pathname)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) } return res })
        .catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ detail: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    )
  }
})
