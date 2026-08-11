import { create } from 'zustand'

/**
 * One package-file request as reported by the service worker's fetch
 * handler. Every row is real: the worker only reports requests that were
 * actually intercepted at /scorm-files/...
 */
export interface NetworkEntry {
  id: string
  /** Intercepted path, e.g. `/scorm-files/{sessionId}/index.html`. */
  path: string
  /** True when the file was found in the session cache. */
  hit: boolean
  /** HTTP status served (200 from cache, 404 on miss). */
  status: number
  timestamp: number
  durationMs: number
}

/** Cap so a long-running course can't grow memory without bound. */
const MAX_ENTRIES = 500

interface NetworkState {
  entries: NetworkEntry[]
  addEntry: (entry: Omit<NetworkEntry, 'id'>) => void
  clearEntries: () => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => {
      const next = [...state.entries, { id: crypto.randomUUID(), ...entry }]
      return {
        entries: next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next,
      }
    }),
  clearEntries: () => set({ entries: [] }),
}))
