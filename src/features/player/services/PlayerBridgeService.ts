/**
 * Manages service worker registration and package file caching.
 * Converts ZIP-extracted bytes into cached HTTP responses that the
 * sandboxed iframe can fetch by path.
 */

import type { IScormAdapter, ScormVersion } from '@/shared/types'

// ---------------------------------------------------------------------------
// MIME type guessing
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  html: 'text/html;charset=utf-8',
  htm: 'text/html;charset=utf-8',
  js: 'application/javascript',
  mjs: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

function mime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

let _swRegistration: ServiceWorkerRegistration | null = null

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  if (_swRegistration) return
  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    // Wait until the SW is active before we start caching files.
    await navigator.serviceWorker.ready
  } catch (e) {
    console.warn('[PlayerBridgeService] SW registration failed:', e)
  }
}

function swPost(message: unknown): void {
  navigator.serviceWorker.controller?.postMessage(message)
}

// ---------------------------------------------------------------------------
// File caching
// ---------------------------------------------------------------------------

export async function cachePackageFiles(
  sessionId: string,
  filePaths: string[],
  getFile: (path: string) => Promise<Uint8Array>,
): Promise<void> {
  await registerServiceWorker()

  // Cache all files concurrently, in batches to avoid memory spikes.
  const BATCH = 20
  for (let i = 0; i < filePaths.length; i += BATCH) {
    await Promise.all(
      filePaths.slice(i, i + BATCH).map(async (path) => {
        const bytes = await getFile(path)
        swPost({ type: 'CACHE_FILE', sessionId, path, buffer: bytes.buffer, mimeType: mime(path) })
      }),
    )
  }
}

export function clearSessionCache(sessionId: string): void {
  swPost({ type: 'CLEAR_SESSION', sessionId })
}

export function packageLaunchUrl(sessionId: string, launchPath: string): string {
  return `/scorm-files/${sessionId}/${launchPath}`
}

// ---------------------------------------------------------------------------
// API injection — sets window.API / window.API_1484_11 on the parent window
// ---------------------------------------------------------------------------

/** SCORM 1.2 API proxy shape (methods the SCO calls on window.API). */
interface ScormApiProxy {
  [key: string]: (...args: string[]) => string
}

let _activeApiProxy: ScormApiProxy | null = null

export function injectApiProxy(adapter: IScormAdapter, version: ScormVersion): void {
  removeApiProxy()

  if (version === '1.2') {
    _activeApiProxy = {
      LMSInitialize: () => adapter.initialize(),
      LMSFinish: () => adapter.terminate(),
      LMSGetValue: (el) => adapter.getValue(el),
      LMSSetValue: (el, v) => adapter.setValue(el, v),
      LMSCommit: () => adapter.commit(),
      LMSGetLastError: () => adapter.getLastError(),
      LMSGetErrorString: (c) => adapter.getErrorString(c),
      LMSGetDiagnostic: (c) => adapter.getDiagnostic(c),
    }
    ;(window as unknown as Record<string, unknown>)['API'] = _activeApiProxy
  } else {
    _activeApiProxy = {
      Initialize: () => adapter.initialize(),
      Terminate: () => adapter.terminate(),
      GetValue: (el) => adapter.getValue(el),
      SetValue: (el, v) => adapter.setValue(el, v),
      Commit: () => adapter.commit(),
      GetLastError: () => adapter.getLastError(),
      GetErrorString: (c) => adapter.getErrorString(c),
      GetDiagnostic: (c) => adapter.getDiagnostic(c),
    }
    ;(window as unknown as Record<string, unknown>)['API_1484_11'] = _activeApiProxy
  }
}

export function removeApiProxy(): void {
  const w = window as unknown as Record<string, unknown>
  delete w['API']
  delete w['API_1484_11']
  _activeApiProxy = null
}
