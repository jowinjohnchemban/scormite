/**
 * Advanced mode and the package runtime are separate files, loaded on demand
 * and named by content hash, so every deployment replaces them. A tab opened
 * before a deployment then asks for a file that no longer exists and the
 * import fails. These helpers recognise that failure so it can be explained
 * as what it is — an update — instead of as a broken interface.
 */

// Chrome, Firefox, and Safari word the failure differently; Vite reports a
// stylesheet it could not preload for the chunk.
const STALE_IMPORT =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** Whether an error is a lazily loaded file that a newer deployment replaced. */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return STALE_IMPORT.test(message)
}

export const STALE_BUILD_MESSAGE =
  'SCORMite was updated while this page was open. Reload the page to use the new version.'
