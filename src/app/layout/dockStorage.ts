/**
 * Storage keys for the dock.
 *
 * Two independent things are persisted:
 *  - *which* panels are docked where, and whether they're open — owned by
 *    `PanelRegistry`'s zustand `persist` middleware under
 *    `PANEL_LAYOUT_STORAGE_KEY`.
 *  - *how big* each region is — owned by react-resizable-panels'
 *    `useDefaultLayout`, which writes its own `react-resizable-panels:<groupId>:…`
 *    keys. "Reset layout" has to clear those too, hence the shared prefix.
 */

export const PANEL_LAYOUT_STORAGE_KEY = 'scormite-dock-layout'

const DOCK_GROUP_ID_PREFIX = 'scormite-dock-'
const PANEL_SIZE_KEY_PREFIX = `react-resizable-panels:${DOCK_GROUP_ID_PREFIX}`

/** Stable group id for a resizable group in the dock. */
export function dockGroupId(name: string): string {
  return `${DOCK_GROUP_ID_PREFIX}${name}`
}

/** Remove every stored region size belonging to a Scormite dock group. */
export function clearStoredPanelSizes(): void {
  if (typeof localStorage === 'undefined') return
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(PANEL_SIZE_KEY_PREFIX)) doomed.push(key)
  }
  for (const key of doomed) localStorage.removeItem(key)
}
