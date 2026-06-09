import { precacheAndRoute } from 'workbox-precaching'
import { skipWaiting, clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
skipWaiting()
clientsClaim()

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/photos/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }, status: 503
      }))
    )
    return
  }
})
