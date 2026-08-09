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

  event.respondWith(
    caches.match(event.request).then(
      (cached) => {
        if (debug) console.debug(`[Scormite service worker] ${cached ? 'hit' : 'miss'}`, url.pathname)
        return cached ?? new Response('Not found', { status: 404 })
      },
    ),
  )
})
