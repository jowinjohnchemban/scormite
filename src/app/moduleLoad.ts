/**
 * Advanced mode and the package runtime are separate files, loaded on demand
 * and named by content hash. Loading one can fail: a deployment replaced the
 * file after this page was opened, the connection dropped, or the request was
 * blocked. The browser's error does not say which, so it is recognised here and
 * explained without guessing the cause.
 */

// Chrome, Firefox, and Safari word the failure differently; Vite reports a
// stylesheet it could not preload for the chunk.
const MODULE_LOAD_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** Whether an error is a lazily loaded part of the app that could not be fetched. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return MODULE_LOAD_FAILURE.test(message)
}

export const MODULE_LOAD_MESSAGE =
  'Part of SCORMite could not be loaded — usually because the site was updated while this page was open, or the connection dropped. Reload the page to load it again.'

/**
 * Import a lazily loaded part of the app, retrying once if it fails. A browser
 * may remember a failed module fetch and fail every later import of the same
 * URL, so the retry uses the failed URL (taken from the error) with a one-off
 * query. A dropped connection then recovers on its own; a file a deployment
 * replaced fails again and is reported.
 */
export async function importWithRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    const url = isModuleLoadError(error)
      ? (error as Error).message.match(/(https?:\/\/[^\s'"]+|\/[^\s'"]+\.[cm]?[jt]sx?)/)?.[1]
      : undefined
    if (!url) throw error
    try {
      return (await import(/* @vite-ignore */ `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}`)) as T
    } catch {
      throw error
    }
  }
}
