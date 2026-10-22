import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LearnerInfo } from '@/shared/types'

export const LEARNER_STORAGE_KEY = 'scormite-learner'

interface LearnerState extends LearnerInfo {
  setLearner: (learner: LearnerInfo) => void
}

/** What a course sees until the tester sets a learner. */
export const DEFAULT_LEARNER: LearnerInfo = { id: 'test-learner', name: 'Learner, Test' }

/**
 * The learner identity SCORMite reports to courses, remembered in this
 * browser. Starts as a sample learner because every LMS supplies one: a
 * course that shows the name or keys on the ID should be tested with real
 * values. The name uses the "Last, First" form SCORM 1.2 specifies.
 */
export const useLearnerStore = create<LearnerState>()(
  persist(
    (set) => ({
      ...DEFAULT_LEARNER,
      setLearner: ({ id, name }) => set({ id: id.trim(), name: name.trim() }),
    }),
    {
      name: LEARNER_STORAGE_KEY,
      partialize: (state): LearnerInfo => ({ id: state.id, name: state.name }),
    },
  ),
)

/** A learner ID must be a single token: SCORM identifiers have no whitespace. */
export function learnerIdProblem(id: string): string | null {
  const trimmed = id.trim()
  if (trimmed === '') return null
  if (/\s/.test(trimmed)) return 'The learner ID cannot contain spaces.'
  if (trimmed.length > 255) return 'The learner ID can be at most 255 characters.'
  return null
}
