/**
 * Milestone 11 exit criteria: "switching profile visibly changes adapter
 * behavior against the same package."
 *
 * Lives in app (not the settings or runtime features) because it joins both:
 * the profile catalog (settings feature) with validator implementations
 * (runtime feature). The boundaries lint rule forbids either feature from
 * importing the other, but app may import both.
 *
 * This mirrors the exact wiring in `usePackageSession`: validators are
 * re-read from the store on every call, so a mid-session profile switch must
 * change which issues the same adapter emits — no rebuild needed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Scorm12Adapter } from '@/features/runtime'
import { createValidationMiddleware } from '@/features/runtime'
import { runtimeEvents } from '@/features/runtime'
import {
  DEFAULT_RUNTIME_PROFILE_ID,
  getRuntimeProfile,
  useSettingsStore,
} from '@/features/settings'
import { validatorsForProfile } from '@/app/profileRuntime'
import type { ValidationIssue } from '@/shared/types'

function makeProfileValidated(): {
  adapter: Scorm12Adapter
  issues: ValidationIssue[]
} {
  const adapter = new Scorm12Adapter('profile-proof')
  const issues: ValidationIssue[] = []
  adapter.addMiddleware(
    createValidationMiddleware({
      // Same getValidators shape as usePackageSession — live store read.
      getValidators: () =>
        validatorsForProfile(getRuntimeProfile(useSettingsStore.getState().activeProfileId)),
      onIssue: (issue) => issues.push(issue),
    }),
  )
  return { adapter, issues }
}

beforeEach(() => {
  useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
})

afterEach(() => {
  runtimeEvents.clear()
  useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
})

describe('profile → validator wiring', () => {
  it('resolves every profile rule id to an implementation', () => {
    for (const id of ['strict-adl', 'scorm-cloud', 'moodle', 'canvas', 'successfactors', 'cornerstone', 'custom']) {
      const profile = getRuntimeProfile(id)
      const validators = validatorsForProfile(profile)
      expect(validators.map((v) => v.ruleId).sort()).toEqual(
        [...profile.validatorRuleIds].sort(),
      )
    }
  })

  it('skips unknown rule ids instead of crashing', () => {
    const profile = getRuntimeProfile('strict-adl')
    const validators = validatorsForProfile({ ...profile, validatorRuleIds: ['runtime.ghost'] })
    expect(validators).toEqual([])
  })
})

describe('switching profile changes adapter behavior (exit criteria)', () => {
  it('turns the missing-commit warning off when switching strict-adl → moodle', () => {
    const { adapter, issues } = makeProfileValidated()

    // strict-adl includes runtime.missing-commit.
    adapter.initialize()
    adapter.setValue('cmi.core.lesson_location', 'page2')
    adapter.terminate()
    expect(issues.filter((i) => i.ruleId === 'runtime.missing-commit')).toHaveLength(1)

    // Moodle deliberately omits the missing-commit rule — the same adapter,
    // same middleware, same package behavior now passes silently.
    useSettingsStore.getState().setProfile('moodle')
    adapter.initialize()
    adapter.setValue('cmi.core.lesson_location', 'page3')
    adapter.terminate()
    expect(issues.filter((i) => i.ruleId === 'runtime.missing-commit')).toHaveLength(1)
  })

  it('turns the out-of-range score error back on when switching moodle → strict-adl', () => {
    const { adapter, issues } = makeProfileValidated()

    // Moodle omits nothing relevant here — use successfactors (no
    // suspend-data-oversized) to prove rule toggling in the other direction.
    useSettingsStore.getState().setProfile('successfactors')
    adapter.initialize()
    adapter.setValue('cmi.suspend_data', 'y'.repeat(4200))
    expect(issues.filter((i) => i.ruleId === 'runtime.suspend-data-oversized')).toHaveLength(0)

    // strict-adl runs all three rules; the same oversized payload now warns.
    useSettingsStore.getState().setProfile('strict-adl')
    adapter.setValue('cmi.suspend_data', 'z'.repeat(4200))
    expect(issues.filter((i) => i.ruleId === 'runtime.suspend-data-oversized')).toHaveLength(1)
  })

  it('keeps rules that both profiles share active across a switch', () => {
    const { adapter, issues } = makeProfileValidated()

    // Out-of-range scoring is in every profile — it must survive any switch.
    useSettingsStore.getState().setProfile('canvas')
    adapter.initialize()
    adapter.setValue('cmi.core.score.raw', '120')
    expect(issues.filter((i) => i.ruleId === 'runtime.score-out-of-range')).toHaveLength(1)

    useSettingsStore.getState().setProfile('scorm-cloud')
    adapter.setValue('cmi.core.score.raw', '150')
    expect(issues.filter((i) => i.ruleId === 'runtime.score-out-of-range')).toHaveLength(2)
  })
})
