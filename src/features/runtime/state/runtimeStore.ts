import { create } from 'zustand'
import type { ScormVersion } from '@/shared/types'
import type { ScormRuntimeAdapter } from '../adapter/ScormRuntimeAdapter'

interface RuntimeState {
  sessionId: string | null
  scormVersion: ScormVersion | null
  isInitialized: boolean
  isTerminated: boolean
  /** Active adapter instance — held outside serialisable state. */
  adapter: ScormRuntimeAdapter | null

  setAdapter: (adapter: ScormRuntimeAdapter, version: ScormVersion) => void
  setInitialized: (v: boolean) => void
  setTerminated: (v: boolean) => void
  reset: () => void
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  sessionId: null,
  scormVersion: null,
  isInitialized: false,
  isTerminated: false,
  adapter: null,

  setAdapter: (adapter, scormVersion) =>
    set({ adapter, scormVersion, sessionId: adapter['sessionId'] as string }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setTerminated: (isTerminated) => set({ isTerminated }),
  reset: () =>
    set({ adapter: null, sessionId: null, scormVersion: null, isInitialized: false, isTerminated: false }),
}))
