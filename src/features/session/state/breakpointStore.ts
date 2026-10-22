import { create } from 'zustand'
import type { Breakpoint, BreakpointHit } from '@/shared/types'

/**
 * The session feature's breakpoint store.
 *
 * The *adapter* is the source of truth for whether execution is paused; this
 * store mirrors that state for the UI and owns the breakpoint list. Because
 * features may not reach into each other, resuming cannot call the runtime
 * store directly — the app layer injects a resume handler in
 * `usePackageSession` after wiring the adapter.
 */
export type ResumeHandler = () => void

interface BreakpointState {
  breakpoints: Breakpoint[]
  /** True while the adapter is holding execution at a breakpoint. */
  paused: boolean
  /** The most recent pause, or null while running. */
  currentHit: BreakpointHit | null
  /** Injected by the app layer — performs the actual adapter resume. */
  resumeHandler: ResumeHandler | null

  addBreakpoint: (draft: Omit<Breakpoint, 'id' | 'enabled' | 'hitCount'>) => Breakpoint
  removeBreakpoint: (id: string) => void
  toggleBreakpoint: (id: string) => void
  clearBreakpoints: () => void
  /** Record a hit: pause, remember it, and bump the breakpoint's hit count. */
  recordHit: (hit: BreakpointHit) => void
  /** Mirror the adapter's pause state; clears the current hit on resume. */
  setPausedFlag: (paused: boolean) => void
  setResumeHandler: (handler: ResumeHandler | null) => void
  /** Resume execution via the injected handler. */
  resume: () => void
  reset: () => void
}

export const useBreakpointStore = create<BreakpointState>((set, get) => ({
  breakpoints: [],
  paused: false,
  currentHit: null,
  resumeHandler: null,

  addBreakpoint: (draft) => {
    const breakpoint: Breakpoint = { id: crypto.randomUUID(), enabled: true, hitCount: 0, ...draft }
    set((state) => ({ breakpoints: [...state.breakpoints, breakpoint] }))
    return breakpoint
  },

  removeBreakpoint: (id) => set((state) => ({ breakpoints: state.breakpoints.filter((bp) => bp.id !== id) })),

  toggleBreakpoint: (id) =>
    set((state) => ({
      breakpoints: state.breakpoints.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp)),
    })),

  clearBreakpoints: () => set({ breakpoints: [] }),

  recordHit: (hit) =>
    set((state) => ({
      paused: true,
      currentHit: hit,
      breakpoints: state.breakpoints.map((bp) =>
        bp.id === hit.breakpointId ? { ...bp, hitCount: bp.hitCount + 1 } : bp,
      ),
    })),

  setPausedFlag: (paused) => set({ paused, ...(paused ? {} : { currentHit: null }) }),

  setResumeHandler: (resumeHandler) => set({ resumeHandler }),

  resume: () => {
    const handler = get().resumeHandler
    if (handler) handler()
  },

  reset: () => set({ breakpoints: [], paused: false, currentHit: null, resumeHandler: null }),
}))
