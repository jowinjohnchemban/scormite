import { create } from 'zustand'

interface InspectorState {
  values: Record<string, string>
  changedPaths: string[]
  setBaseline: (values: Record<string, string>) => void
  updateValues: (values: Record<string, string>) => void
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
  setBaseline: (values) => set({ values, changedPaths: [] }),
  updateValues: (values) =>
    set((state) => ({
      values,
      changedPaths: findChangedPaths(state.values, values),
    })),
  reset: () => set({ values: {}, changedPaths: [] }),
}))
