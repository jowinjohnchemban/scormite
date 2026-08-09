import { create } from 'zustand'
import type { CmiSnapshot } from '@/shared/types'

interface TimelineState {
  snapshots: CmiSnapshot[]
  /** Null means the inspector follows the live runtime. */
  cursor: number | null
  captureSnapshot: (snapshot: Omit<CmiSnapshot, 'changedPaths'>) => void
  scrubTo: (index: number) => void
  resumeLive: () => void
  reset: () => void
}

function changedPaths(previous: Record<string, string>, next: Record<string, string>): string[] {
  const paths = new Set([...Object.keys(previous), ...Object.keys(next)])
  return [...paths].filter((path) => previous[path] !== next[path])
}

export const useTimelineStore = create<TimelineState>((set) => ({
  snapshots: [],
  cursor: null,
  captureSnapshot: (snapshot) =>
    set((state) => {
      const previous = state.snapshots.at(-1)?.data ?? {}
      return {
        snapshots: [
          ...state.snapshots,
          { ...snapshot, changedPaths: changedPaths(previous, snapshot.data) },
        ],
      }
    }),
  scrubTo: (index) =>
    set((state) => ({
      cursor: index >= 0 && index < state.snapshots.length ? index : null,
    })),
  resumeLive: () => set({ cursor: null }),
  reset: () => set({ snapshots: [], cursor: null }),
}))
