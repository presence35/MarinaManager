import { precacheAndRoute } from 'workbox-precaching'
import { skipWaiting, clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
skipWaiting()
clientsClaim()

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Let downloads stream directly to the browser; proxying large backups
  // through the SW causes aborted downloads (NS_BINDING_ABORTED) in Firefox.
  if (url.pathname === '/api/export') return
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }, status: 503
      }))
    )
    return
  }
})
