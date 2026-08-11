/**
 * Reads the browser storage that Scormite actually uses.
 *
 * The exit criteria for the Storage panel mention "IndexedDB contents", but
 * Scormite never touches IndexedDB — package files live in the Cache Storage
 * API (scormite-pkg-* caches, served by the service worker) and UI state
 * lives in localStorage (dock layout, settings). This service reports those
 * real stores, plus the browser's storage estimate.
 */

export interface StorageEntry {
  id: string
  origin: 'cache' | 'local'
  /** Cache name or localStorage key. */
  key: string
  /** Human label for the store kind. */
  kind: 'Cache Storage' | 'localStorage'
  /** Number of items (requests in a cache). Null for localStorage. */
  itemCount: number | null
  /** Total payload size in bytes. Null when not measurable. */
  sizeBytes: number | null
}

export interface StorageReport {
  entries: StorageEntry[]
  /** From navigator.storage.estimate(), may be null when unsupported. */
  usageBytes: number | null
  quotaBytes: number | null
  generatedAt: Date
}

async function cacheEntrySize(cache: Cache, request: Request): Promise<number> {
  try {
    const response = await cache.match(request)
    const blob = await response?.blob()
    return blob?.size ?? 0
  } catch {
    return 0
  }
}

async function inspectCaches(): Promise<StorageEntry[]> {
  if (typeof caches === 'undefined') return []
  const names = await caches.keys()
  const entries = await Promise.all(
    names.map(async (name) => {
      const cache = await caches.open(name)
      const requests = await cache.keys()
      const sizes = await Promise.all(requests.map((request) => cacheEntrySize(cache, request)))
      return {
        id: `cache:${name}`,
        origin: 'cache' as const,
        key: name,
        kind: 'Cache Storage' as const,
        itemCount: requests.length,
        sizeBytes: sizes.reduce((sum, size) => sum + size, 0),
      }
    }),
  )
  return entries
}

function inspectLocalStorage(): StorageEntry[] {
  if (typeof localStorage === 'undefined') return []
  const entries: StorageEntry[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key === null) continue
    const value = localStorage.getItem(key) ?? ''
    entries.push({
      id: `local:${key}`,
      origin: 'local',
      key,
      kind: 'localStorage',
      itemCount: null,
      sizeBytes: new TextEncoder().encode(value).byteLength,
    })
  }
  return entries
}

/** Snapshot every browser storage bucket Scormite uses. */
export async function inspectStorage(): Promise<StorageReport> {
  const [caches, local] = await Promise.all([inspectCaches(), Promise.resolve(inspectLocalStorage())])

  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  if (typeof navigator !== 'undefined' && 'storage' in navigator) {
    try {
      const estimate = await navigator.storage.estimate()
      usageBytes = estimate.usage ?? null
      quotaBytes = estimate.quota ?? null
    } catch {
      // Storage estimate is not available in every context.
    }
  }

  return {
    entries: [...caches, ...local],
    usageBytes,
    quotaBytes,
    generatedAt: new Date(),
  }
}

/** Format a byte count for display: B, KB, MB. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024
    unit = units[i]
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`
}
