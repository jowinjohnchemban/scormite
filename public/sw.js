/* Scormite package file service worker.
 * Serves ZIP-extracted files from the Cache Storage API at
 * /scorm-files/{sessionId}/{...path}
 *
 * Messages accepted (from main thread via postMessage):
 *   { type: 'CACHE_FILE', sessionId, path, buffer: ArrayBuffer, mimeType }
 *   { type: 'CLEAR_SESSION', sessionId }
 */

const CACHE_PREFIX = 'scormite-pkg-'
let debug = false

// Activate updated workers immediately instead of leaving them "waiting"
// for a second navigation. This is a dev-tool worker serving package files,
// not a long-lived app shell — stale code should never linger.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data.type !== 'string') return

  if (data.type === 'SET_DEBUG') {
    debug = data.enabled === true
    return
  }

  if (data.type === 'CACHE_FILE') {
    const { sessionId, path, buffer, mimeType } = data
    const url = `/scorm-files/${sessionId}/${path}`
    if (debug) console.debug('[Scormite service worker] caching', url)
    event.waitUntil(
      caches.open(CACHE_PREFIX + sessionId).then((cache) => {
        const response = new Response(buffer, {
          headers: { 'Content-Type': mimeType || 'application/octet-stream' },
        })
        return cache.put(url, response)
      }).then(
        () => event.ports[0]?.postMessage({ ok: true }),
        (error) => event.ports[0]?.postMessage({ ok: false, error: String(error) }),
      ),
    )
  }

  if (data.type === 'CLEAR_SESSION') {
    event.waitUntil(caches.delete(CACHE_PREFIX + data.sessionId))
  }
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/scorm-files/')) return

  const startedAt = performance.now()

  event.respondWith(
    caches.match(event.request).then(
      (cached) => {
        const hit = cached !== undefined
        const status = hit ? 200 : 404
        if (debug) console.debug(`[Scormite service worker] ${hit ? 'hit' : 'miss'}`, url.pathname)
        // Report the fetch to every window client. The course itself loads in
        // an iframe, so the requesting client is usually the iframe — but the
        // Network panel lives in the main window, which must see it too.
        const payload = {
          type: 'FETCH_EVENT',
          path: url.pathname,
          hit,
          status,
          timestamp: Date.now(),
          durationMs: performance.now() - startedAt,
        }
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          for (const client of clients) client.postMessage(payload)
        })
        return cached ?? new Response('Not found', { status: 404 })
      },
    ),
  )
})
