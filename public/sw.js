// ============================================================
// sw.js — Service worker FlowPort (installabilité PWA + secours
// hors-ligne). Stratégie : réseau d'abord, cache en repli — les
// données trafic restent toujours fraîches, le shell de l'app
// (HTML/JS/CSS/icônes) survit à une coupure réseau.
// ============================================================

const CACHE = 'flowport-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cles = await caches.keys()
    await Promise.all(cles.filter(c => c !== CACHE).map(c => caches.delete(c)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // On ne gère que les GET de notre propre origine — les appels
  // Firebase/TomTom/Groq (cross-origin) passent en direct.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const reponse = await fetch(request)
      if (reponse.ok) cache.put(request, reponse.clone())
      return reponse
    } catch {
      const enCache = await cache.match(request)
      if (enCache) return enCache
      // Navigation hors-ligne : on ressert le shell de l'app
      if (request.mode === 'navigate') {
        const shell = await cache.match('/')
        if (shell) return shell
      }
      return Response.error()
    }
  })())
})
