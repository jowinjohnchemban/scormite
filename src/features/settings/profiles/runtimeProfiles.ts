/**
 * Runtime profiles — pure data, no imports.
 *
 * A profile has two halves:
 *  - `scormAgainOverrides`: scorm-again `Settings` knobs applied to the API
 *    by the runtime adapter. Kept as `Record<string, unknown>` because this
 *    feature may not import scorm-again (only `features/runtime` may, per
 *    ESLint). The adapter whitelists the keys it will apply — see
 *    `PROFILE_SETTING_KEYS` in `features/runtime/adapter/ScormRuntimeAdapter`.
 *
 *    Knobs used here are verified to be READ at call time by scorm-again
 *    3.2.0: `mastery_override`, `score_overrides_status`, and
 *    `autoCompleteLessonStatus` drive lesson_status derivation in
 *    scorm12.js's terminate stages. `strict_errors` is deliberately NOT used:
 *    it only appears in DefaultSettings in 3.2.0 and is never read, so
 *    configuring it would silently do nothing.
 *
 *  - `validatorRuleIds`: which runtime validation rules run (rule ids are
 *    resolved to implementations by the runtime feature's validator registry;
 *    the app layer joins the two).
 *
 * These are best-effort approximations of each LMS's typical SCORM behavior,
 * not guarantees — they exist so a developer can watch a package behave
 * differently against the same content, then tune from there.
 */

export type RuntimeProfileId =
  | 'strict-adl'
  | 'scorm-cloud'
  | 'moodle'
  | 'canvas'
  | 'successfactors'
  | 'cornerstone'
  | 'custom'

export interface RuntimeProfile {
  id: RuntimeProfileId
  /** Short name for the toolbar menu. */
  label: string
  /** Longer rationale, surfaced as the menu item's tooltip. */
  description: string
  /**
   * scorm-again Settings overrides for this profile. Opaque here — the
   * runtime adapter whitelists and applies the keys it supports.
   */
  scormAgainOverrides: Record<string, unknown>
  /** Runtime validator rule ids enabled for this profile. */
  validatorRuleIds: string[]
}

/** The profile active when no choice has been persisted yet. */
export const DEFAULT_RUNTIME_PROFILE_ID: RuntimeProfileId = 'strict-adl'

export const RUNTIME_PROFILES: readonly RuntimeProfile[] = [
  {
    id: 'strict-adl',
    label: 'Strict ADL',
    description:
      'Spec-precise data model. All validation rules run; lesson status is derived from the mastery score per the 1.2 spec.',
    scormAgainOverrides: {
      // Spec: LMS may override lesson_status from the mastery score at finish.
      mastery_override: true,
      // Override even a module-set status when the score disagrees.
      score_overrides_status: true,
      // Unset status stays "incomplete" unless the SCO sets it.
      autoCompleteLessonStatus: false,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
      'runtime.missing-commit',
    ],
  },
  {
    id: 'scorm-cloud',
    label: 'SCORM Cloud',
    description:
      'Compatibility benchmark: all validation rules run, mastery applies, but a module-set status is respected.',
    scormAgainOverrides: {
      mastery_override: true,
      // SCORM Cloud records what the SCO reported rather than re-deriving it.
      score_overrides_status: false,
      autoCompleteLessonStatus: false,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
      'runtime.missing-commit',
    ],
  },
  {
    id: 'moodle',
    label: 'Moodle',
    description:
      'Persists the session on termination (no missing-commit warning); unset status completes on finish.',
    scormAgainOverrides: {
      mastery_override: true,
      // Moodle marks a finished-but-unset session completed.
      autoCompleteLessonStatus: true,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
    ],
  },
  {
    id: 'canvas',
    label: 'Canvas',
    description:
      'Persists the session on termination; completion is module-driven, so a module-set status is never overridden.',
    scormAgainOverrides: {
      mastery_override: true,
      // Canvas completion comes from the course/module, not the score.
      score_overrides_status: false,
      autoCompleteLessonStatus: false,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
    ],
  },
  {
    id: 'successfactors',
    label: 'SuccessFactors',
    description:
      'Tolerates larger suspend_data payloads (no oversized warning); mastery applies.',
    scormAgainOverrides: {
      mastery_override: true,
      autoCompleteLessonStatus: false,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.missing-commit',
    ],
  },
  {
    id: 'cornerstone',
    label: 'Cornerstone',
    description:
      'Strict data model with score-driven status: all validation rules run.',
    scormAgainOverrides: {
      mastery_override: true,
      score_overrides_status: true,
      autoCompleteLessonStatus: false,
    },
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
      'runtime.missing-commit',
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    description:
      'scorm-again defaults with all validation rules — a blank slate for tuning.',
    scormAgainOverrides: {},
    validatorRuleIds: [
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
      'runtime.missing-commit',
    ],
  },
]

/** All profile ids in display order, for menus and validation. */
export const RUNTIME_PROFILE_IDS: readonly RuntimeProfileId[] = RUNTIME_PROFILES.map(
  (profile) => profile.id,
)

/**
 * Resolve a profile by id. Unknown ids (e.g. a stale persisted value after a
 * downgrade) fall back to the default instead of returning `undefined` and
 * breaking every consumer.
 */
export function getRuntimeProfile(id: RuntimeProfileId | string): RuntimeProfile {
  return (
    RUNTIME_PROFILES.find((profile) => profile.id === id) ??
    RUNTIME_PROFILES.find((profile) => profile.id === DEFAULT_RUNTIME_PROFILE_ID)!
  )
}
