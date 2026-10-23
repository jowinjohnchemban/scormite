/**
 * The course the learner is stepping through: its launchable items, which
 * one is running, each item's progress, and what navigation is possible.
 *
 * Components never launch anything directly. They call `go()`, which turns
 * the intent into either a launch request (flow mode — manifest order) or a
 * navigation request for the sequencing engine (SCORM 2004). Both are
 * performed by the course session once the old SCO's iframe is gone, so its
 * unload-time LMSFinish reaches the old runtime state.
 */

import { create } from 'zustand'
import type { LaunchableItem } from '@/shared/types'
import type { CmiSummary } from '@/app/course/summarizeCmi'
import { CourseNavigator } from '@/app/course/CourseNavigator'

/** `resume` relaunches with the item's stored data; `new` discards it first. */
export type LaunchMode = 'resume' | 'new'

export interface LaunchRequest {
  itemId: string
  mode: LaunchMode
}

export type CourseRequest = 'continue' | 'previous' | 'choice'

/** A navigation the learner asked for (outline, Previous / Next, Relaunch). */
export interface NavigationIntent {
  request: CourseRequest
  /** Item identifier, for `choice`. */
  targetId?: string
  mode: LaunchMode
}

export interface NavigationAvailability {
  canContinue: boolean
  canPrevious: boolean
  /** Items a choice may target; `null` when every item may be chosen. */
  choices: string[] | null
  /** LMS controls the running SCO asks the player to hide. */
  hiddenControls: string[]
}

const OPEN_NAVIGATION: NavigationAvailability = {
  canContinue: true,
  canPrevious: true,
  choices: null,
  hiddenControls: [],
}

/** What a notice's button does: "clear-progress" discards the resumed progress and restarts the course. */
export type NoticeAction = 'clear-progress'

interface CourseState {
  items: LaunchableItem[]
  /** True when scorm-again's SCORM 2004 sequencing engine drives navigation. */
  sequenced: boolean
  currentItemId: string | null
  /** Last known progress per item identifier. */
  progress: Record<string, CmiSummary>
  /** Engine-reported availability (sequenced mode only). */
  navigation: NavigationAvailability
  /** Bumped on every launch; keys the player iframe so it always remounts. */
  launchCount: number
  pendingLaunch: LaunchRequest | null
  pendingNavigation: NavigationIntent | null
  /** Why the course ended (exitAll, suspendAll, end of course), if it did. */
  endedReason: string | null
  /** A short, dismissible message (e.g. a refused navigation, a resumed session). */
  notice: string | null
  noticeTone: 'info' | 'warning'
  /** A button the notice offers, if any. */
  noticeAction: NoticeAction | null

  setCourse: (items: LaunchableItem[], sequenced: boolean) => void
  setSequenced: (sequenced: boolean) => void
  /** Navigate from the current item — the one entry point for components. */
  go: (intent: NavigationIntent) => void
  requestLaunch: (itemId: string, mode?: LaunchMode) => void
  completeLaunch: (itemId: string) => void
  completeNavigation: () => void
  setProgress: (itemId: string, summary: CmiSummary) => void
  mergeProgress: (progress: Record<string, CmiSummary>) => void
  clearProgress: () => void
  setNavigation: (navigation: NavigationAvailability) => void
  setEnded: (reason: string | null) => void
  setNotice: (notice: string | null, tone?: 'info' | 'warning', action?: NoticeAction | null) => void
  reset: () => void
}

const INITIAL = {
  items: [],
  sequenced: false,
  currentItemId: null,
  progress: {},
  navigation: OPEN_NAVIGATION,
  launchCount: 0,
  pendingLaunch: null,
  pendingNavigation: null,
  endedReason: null,
  notice: null,
  noticeTone: 'warning',
  noticeAction: null,
} satisfies Partial<CourseState>

/** What flow mode allows from `currentItemId`: anything, in manifest order. */
export function flowAvailability(items: LaunchableItem[], currentItemId: string | null): NavigationAvailability {
  const navigator = new CourseNavigator(items)
  return {
    canContinue: navigator.next(currentItemId) !== undefined,
    canPrevious: navigator.previous(currentItemId) !== undefined,
    choices: null,
    hiddenControls: [],
  }
}

export const useCourseStore = create<CourseState>((set, get) => ({
  ...INITIAL,

  // launchCount keeps counting across courses so the player key never repeats.
  setCourse: (items, sequenced) => set((state) => ({ ...INITIAL, items, sequenced, launchCount: state.launchCount })),

  setSequenced: (sequenced) => set({ sequenced, navigation: OPEN_NAVIGATION }),

  go: (intent) => {
    const state = get()
    if (state.pendingLaunch || state.pendingNavigation) return
    if (state.sequenced) {
      // Check the engine's look-ahead first, so a disallowed request never
      // unloads the running SCO.
      const nav = state.navigation
      const allowed =
        intent.request === 'continue'
          ? nav.canContinue
          : intent.request === 'previous'
            ? nav.canPrevious
            : nav.choices === null || (intent.targetId !== undefined && nav.choices.includes(intent.targetId))
      if (!allowed) {
        set({ notice: "The course's sequencing rules do not allow that right now.", noticeAction: null })
        return
      }
      set({ pendingNavigation: intent, notice: null, noticeAction: null })
      return
    }
    const navigator = new CourseNavigator(state.items)
    const target =
      intent.request === 'continue'
        ? navigator.next(state.currentItemId)
        : intent.request === 'previous'
          ? navigator.previous(state.currentItemId)
          : navigator.find(intent.targetId)
    if (target)
      set({ pendingLaunch: { itemId: target.identifier, mode: intent.mode }, notice: null, noticeAction: null })
  },

  requestLaunch: (itemId, mode = 'resume') =>
    set((state) =>
      state.items.some((item) => item.identifier === itemId)
        ? { pendingLaunch: { itemId, mode }, endedReason: null }
        : {},
    ),

  completeLaunch: (itemId) =>
    set((state) => ({
      currentItemId: itemId,
      launchCount: state.launchCount + 1,
      pendingLaunch: null,
      pendingNavigation: null,
    })),

  completeNavigation: () => set({ pendingNavigation: null }),

  setProgress: (itemId, summary) => set((state) => ({ progress: { ...state.progress, [itemId]: summary } })),

  mergeProgress: (progress) => set((state) => ({ progress: { ...state.progress, ...progress } })),

  clearProgress: () => set({ progress: {} }),

  setNavigation: (navigation) => set({ navigation }),

  setEnded: (endedReason) => set({ endedReason }),

  setNotice: (notice, tone = 'warning', action = null) => set({ notice, noticeTone: tone, noticeAction: action }),

  reset: () => set(INITIAL),
}))
