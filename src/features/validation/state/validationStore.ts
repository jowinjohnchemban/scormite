import { create } from 'zustand'
import type { ValidationIssue } from '@/shared/types'

/**
 * The validation feature's store.
 *
 * Issues arrive from two directions: static manifest validation runs when a
 * package loads (the app layer calls `addIssues`), and the runtime
 * validation middleware pushes individual issues live via the injected
 * `onIssue` callback. `lastRunAt` distinguishes "never validated" from
 * "validated, clean" in the panel.
 */
interface ValidationState {
  issues: ValidationIssue[]
  /** Timestamp of the most recent validation pass, or null before any run. */
  lastRunAt: number | null

  addIssue: (issue: ValidationIssue) => void
  addIssues: (issues: ValidationIssue[]) => void
  removeIssue: (id: string) => void
  clearIssues: () => void
  reset: () => void
}

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],
  lastRunAt: null,

  addIssue: (issue) =>
    set((state) => ({ issues: [...state.issues, issue], lastRunAt: Date.now() })),

  addIssues: (issues) =>
    set((state) => ({ issues: [...state.issues, ...issues], lastRunAt: Date.now() })),

  removeIssue: (id) =>
    set((state) => ({ issues: state.issues.filter((issue) => issue.id !== id) })),

  clearIssues: () => set({ issues: [] }),

  reset: () => set({ issues: [], lastRunAt: null }),
}))
