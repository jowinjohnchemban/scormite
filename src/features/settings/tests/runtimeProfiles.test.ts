import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RUNTIME_PROFILE_ID,
  getRuntimeProfile,
  RUNTIME_PROFILE_IDS,
  RUNTIME_PROFILES,
} from '../profiles/runtimeProfiles'

describe('RUNTIME_PROFILES', () => {
  it('has the seven milestone profiles', () => {
    expect(RUNTIME_PROFILES.map((p) => p.id)).toEqual([
      'strict-adl',
      'scorm-cloud',
      'moodle',
      'canvas',
      'successfactors',
      'cornerstone',
      'custom',
    ])
  })

  it('has unique ids', () => {
    const ids = RUNTIME_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every profile a label and a description', () => {
    for (const profile of RUNTIME_PROFILES) {
      expect(profile.label.length).toBeGreaterThan(0)
      expect(profile.description.length).toBeGreaterThan(0)
    }
  })

  it('gives every profile a non-empty validator rule list', () => {
    for (const profile of RUNTIME_PROFILES) {
      expect(profile.validatorRuleIds.length).toBeGreaterThan(0)
      for (const ruleId of profile.validatorRuleIds) {
        expect(typeof ruleId).toBe('string')
        expect(ruleId.startsWith('runtime.')).toBe(true)
      }
    }
  })

  it('only tunes whitelisted scorm-again knobs', () => {
    // Mirrors PROFILE_SETTING_KEYS in features/runtime — kept in sync by
    // convention, since settings may not import runtime. Any knob added here
    // must also be whitelisted there or it is silently ignored.
    const whitelisted = new Set([
      'mastery_override',
      'score_overrides_status',
      'autoCompleteLessonStatus',
    ])
    for (const profile of RUNTIME_PROFILES) {
      for (const key of Object.keys(profile.scormAgainOverrides)) {
        expect(whitelisted.has(key)).toBe(true)
      }
    }
  })
})

describe('RUNTIME_PROFILE_IDS', () => {
  it('is in the same display order as the catalog', () => {
    expect(RUNTIME_PROFILE_IDS).toEqual(RUNTIME_PROFILES.map((p) => p.id))
  })
})

describe('getRuntimeProfile', () => {
  it('resolves every known id', () => {
    for (const id of RUNTIME_PROFILE_IDS) {
      expect(getRuntimeProfile(id).id).toBe(id)
    }
  })

  it('falls back to the default for an unknown id', () => {
    // A stale persisted value after a downgrade must not crash consumers.
    expect(getRuntimeProfile('definitely-not-a-profile').id).toBe(
      DEFAULT_RUNTIME_PROFILE_ID,
    )
  })
})
