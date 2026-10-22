import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LearnerInfo } from '@/shared/types'

export const LEARNER_STORAGE_KEY = 'scormite-learner'

interface LearnerState extends LearnerInfo {
  setLearner: (learner: LearnerInfo) => void
}

/**
 * The learner identity SCORMite reports to courses, remembered in this
 * browser. Empty by default — like an LMS account without a name — until
 * the tester sets one.
 */
export const useLearnerStore = create<LearnerState>()(
  persist(
    (set) => ({
      id: '',
      name: '',
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
