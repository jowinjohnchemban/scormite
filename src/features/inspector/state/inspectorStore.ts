import { create } from 'zustand'

interface InspectorState {
  values: Record<string, string>
  changedPaths: string[]
  /** True while the timeline is scrubbing a historical snapshot. */
  isReplay: boolean
  setBaseline: (values: Record<string, string>) => void
  updateValues: (values: Record<string, string>) => void
  /** Shows a historical snapshot instead of live runtime state. */
  showSnapshot: (data: Record<string, string>, changedPaths: string[]) => void
  /** Leaves replay mode; live runtime state takes over again. */
  showLive: () => void
  reset: () => void
}

function findChangedPaths(previous: Record<string, string>, next: Record<string, string>): string[] {
  const paths = new Set([...Object.keys(previous), ...Object.keys(next)])
  return [...paths].filter((path) => previous[path] !== next[path])
}

/** Inspector-owned CMI snapshot, fed by the app-level session bridge. */
export const useInspectorStore = create<InspectorState>((set) => ({
  values: {},
  changedPaths: [],
  isReplay: false,
  setBaseline: (values) => set({ values, changedPaths: [] }),
  updateValues: (values) =>
    set((state) => ({
      values,
      changedPaths: findChangedPaths(state.values, values),
    })),
  showSnapshot: (data, changedPaths) => set({ values: data, changedPaths, isReplay: true }),
  showLive: () => set({ isReplay: false }),
  reset: () => set({ values: {}, changedPaths: [], isReplay: false }),
}))
