/**
 * The course the learner is stepping through: its launchable items, which
 * one is running, and each item's last known progress.
 *
 * Components ask for a launch with `requestLaunch`; `usePackageSession`
 * performs it once the old SCO's iframe is gone (so its unload-time
 * LMSFinish reaches the old runtime, not the new one) and then calls
 * `completeLaunch`. Keeping the request in state lets prop-less dock panels
 * (the Advanced-mode outline) navigate without holding the session.
 */

import { create } from 'zustand'
import type { LaunchableItem } from '@/shared/types'
import type { CmiSummary } from '@/app/course/summarizeCmi'

/** `resume` relaunches with the item's stored data; `new` discards it first. */
export type LaunchMode = 'resume' | 'new'

export interface LaunchRequest {
  itemId: string
  mode: LaunchMode
}

interface CourseState {
  items: LaunchableItem[]
  currentItemId: string | null
  /** Last known progress per item identifier. */
  progress: Record<string, CmiSummary>
  /** Bumped on every launch; keys the player iframe so it always remounts. */
  launchCount: number
  pendingLaunch: LaunchRequest | null

  setItems: (items: LaunchableItem[]) => void
  requestLaunch: (itemId: string, mode?: LaunchMode) => void
  completeLaunch: (itemId: string) => void
  setProgress: (itemId: string, summary: CmiSummary) => void
  clearProgress: () => void
  reset: () => void
}

const INITIAL = {
  items: [],
  currentItemId: null,
  progress: {},
  launchCount: 0,
  pendingLaunch: null,
} satisfies Partial<CourseState>

export const useCourseStore = create<CourseState>((set) => ({
  ...INITIAL,

  setItems: (items) => set({ items }),

  requestLaunch: (itemId, mode = 'resume') =>
    set((state) =>
      state.items.some((item) => item.identifier === itemId)
        ? { pendingLaunch: { itemId, mode } }
        : {},
    ),

  completeLaunch: (itemId) =>
    set((state) => ({
      currentItemId: itemId,
      launchCount: state.launchCount + 1,
      pendingLaunch: null,
    })),

  setProgress: (itemId, summary) =>
    set((state) => ({ progress: { ...state.progress, [itemId]: summary } })),

  clearProgress: () => set({ progress: {} }),

  reset: () => set(INITIAL),
}))
