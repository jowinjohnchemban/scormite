import { create } from 'zustand'

export type AppMode = 'basic' | 'advanced'

interface AppModeState {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

/**
 * Single source of truth for Basic vs Advanced mode. Components read this
 * instead of branching on route/location — see docs/ARCHITECTURE.md §Modes.
 */
export const useAppModeStore = create<AppModeState>((set) => ({
  mode: 'basic',
  setMode: (mode) => set({ mode }),
}))
