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

/**
 * A readable 404 for files the package does not contain. When the launch
 * file itself is missing this is what the player shows, so it names the
 * exact path instead of a bare "Not found".
 */
function notFound(pathname) {
  const packagePath = decodeURIComponent(pathname.split('/').slice(3).join('/'))
  const escaped = packagePath.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not in package</title></head>
<body style="margin:0;font:13px/1.5 system-ui,sans-serif;background:#0b0d10;color:#c9d1d9;display:grid;place-items:center;height:100vh">
<div style="max-width:32rem;padding:1.5rem;text-align:center">
<p style="font-weight:600;margin:0 0 .5rem">File not found in this package</p>
<code style="color:#f85149;word-break:break-all">${escaped}</code>
<p style="color:#7f93ab;margin:.75rem 0 0">Check the resource href in imsmanifest.xml and the file's exact path and letter case inside the zip.</p>
</div></body></html>`
  return new Response(body, {
    status: 404,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/scorm-files/')) return

  const startedAt = performance.now()

  event.respondWith(
    // Package files are cached by path only. Launch URLs routinely carry a
    // query string (manifest item parameters, authoring-tool flags), so the
    // lookup must ignore it or the SCO itself 404s.
    caches.match(event.request, { ignoreSearch: true }).then(
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
        return cached ?? notFound(url.pathname)
      },
    ),
  )
})
