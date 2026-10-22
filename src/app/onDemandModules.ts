/**
 * The parts of SCORMite that are not in the start page's JavaScript: Advanced
 * mode (the dock and its panels) and the package runtime (unzip, manifest
 * parsing, scorm-again). Each is its own file, named by content hash.
 *
 * They are fetched once the start page has loaded and the browser is idle, so
 * the start page stays light, yet switching to Advanced mode or opening a
 * package never waits on the network — and never asks for a file that a
 * deployment made after the page was opened has replaced.
 */

import { importWithRetry } from '@/app/moduleLoad'

// Retried once on failure, so a failed fetch (including a failed preload,
// which a browser may remember) does not stick.
export const loadAdvancedMode = () => importWithRetry(() => import('@/app/modes/AdvancedModeShell'))

export const loadOpenPackage = () => importWithRetry(() => import('@/app/course/openPackage'))

/**
 * Fetch the on-demand parts after the page has loaded, when the browser is
 * idle. Advanced mode is only fetched where it can be used (desktop widths).
 * Returns a function that cancels a fetch not yet started.
 */
export function preloadOnDemandModules({ advancedMode }: { advancedMode: boolean }): () => void {
  let cancelled = false
  const preload = () => {
    if (cancelled) return
    // A failed preload is retried when the part is used (importWithRetry).
    void loadOpenPackage().catch(() => undefined)
    if (advancedMode) void loadAdvancedMode().catch(() => undefined)
  }
  const whenIdle = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 3000 })
    else setTimeout(preload, 1000)
  }
  if (document.readyState === 'complete') whenIdle()
  else window.addEventListener('load', whenIdle, { once: true })
  return () => {
    cancelled = true
    window.removeEventListener('load', whenIdle)
  }
}
