// 서비스워커: 앱 셸 캐시 (네트워크 우선, 오프라인이면 캐시)
const CACHE = 'momopang-v3'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const nav = req.mode === 'navigate'
  e.respondWith(
    fetch(req, nav ? { cache: 'no-store' } : undefined)
      .then((res) => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? '/' : req, copy)) }
        return res
      })
      .catch(async () => (await caches.match(nav ? '/' : req)) || new Response('오프라인이에요. 연결을 확인해 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
  )
})
