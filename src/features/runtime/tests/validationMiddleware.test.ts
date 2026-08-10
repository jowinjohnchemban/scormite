import { describe, expect, it, afterEach } from 'vitest'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { Scorm2004Adapter } from '../adapter/Scorm2004Adapter'
import {
  createValidationMiddleware,
  getRuntimeValidator,
  missingCommitValidator,
  outOfRangeScoreValidator,
  oversizedSuspendDataValidator,
  RUNTIME_VALIDATOR_BY_ID,
  type RuntimeValidator,
} from '../adapter/middleware/validationMiddleware'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { ValidationIssue } from '@/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidated(validators: RuntimeValidator[]): {
  adapter: Scorm12Adapter
  issues: ValidationIssue[]
} {
  const adapter = new Scorm12Adapter('validation-test')
  const issues: ValidationIssue[] = []
  adapter.addMiddleware(
    createValidationMiddleware({
      getValidators: () => validators,
      onIssue: (issue) => issues.push(issue),
    }),
  )
  return { adapter, issues }
}

afterEach(() => runtimeEvents.clear())

// ---------------------------------------------------------------------------
// Runtime validators — the Milestone 10 exit criteria (runtime half)
// ---------------------------------------------------------------------------

describe('outOfRangeScoreValidator', () => {
  it('flags a SetValue above 100 on the 1.2 score element', () => {
    const { adapter, issues } = makeValidated([outOfRangeScoreValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', '120')

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'error',
      source: 'runtime',
      ruleId: 'runtime.score-out-of-range',
      location: 'cmi.core.score.raw',
    })
    expect(issues[0]?.message).toContain('120')
  })

  it('flags a SetValue below 0 on the 2004 score element', () => {
    const adapter = new Scorm2004Adapter('validation-test-2004')
    const issues: ValidationIssue[] = []
    adapter.addMiddleware(
      createValidationMiddleware({
        getValidators: () => [outOfRangeScoreValidator],
        onIssue: (issue) => issues.push(issue),
      }),
    )
    adapter.initialize()

    adapter.setValue('cmi.score.raw', '-5')

    expect(issues).toHaveLength(1)
    expect(issues[0]?.ruleId).toBe('runtime.score-out-of-range')
  })

  it('flags a non-numeric score', () => {
    const { adapter, issues } = makeValidated([outOfRangeScoreValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', 'pass')

    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('not a valid number')
  })

  it('ignores in-range scores and non-score elements', () => {
    const { adapter, issues } = makeValidated([outOfRangeScoreValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', '80')
    adapter.setValue('cmi.core.lesson_location', '120')

    expect(issues).toHaveLength(0)
  })
})

describe('oversizedSuspendDataValidator', () => {
  it('flags suspend_data over the 4096-character limit', () => {
    const { adapter, issues } = makeValidated([oversizedSuspendDataValidator])
    adapter.initialize()

    adapter.setValue('cmi.suspend_data', 'x'.repeat(5000))

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      ruleId: 'runtime.suspend-data-oversized',
      location: 'cmi.suspend_data',
    })
  })

  it('ignores suspend_data within the limit and other elements', () => {
    const { adapter, issues } = makeValidated([oversizedSuspendDataValidator])
    adapter.initialize()

    adapter.setValue('cmi.suspend_data', 'x'.repeat(100))
    adapter.setValue('cmi.core.lesson_location', 'x'.repeat(5000))

    expect(issues).toHaveLength(0)
  })
})

describe('missingCommitValidator', () => {
  it('warns when the course terminates without a successful Commit', () => {
    const { adapter, issues } = makeValidated([missingCommitValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.lesson_location', 'page2')
    adapter.terminate()

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      ruleId: 'runtime.missing-commit',
      location: 'Terminate',
    })
  })

  it('stays silent when a Commit succeeded before Terminate', () => {
    const { adapter, issues } = makeValidated([missingCommitValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.lesson_location', 'page2')
    adapter.commit()
    adapter.terminate()

    expect(issues).toHaveLength(0)
  })
})

describe('createValidationMiddleware', () => {
  it('emits one issue per firing rule', () => {
    const { adapter, issues } = makeValidated([
      outOfRangeScoreValidator,
      oversizedSuspendDataValidator,
    ])
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', '150')
    adapter.setValue('cmi.suspend_data', 'y'.repeat(4200))

    expect(issues).toHaveLength(2)
    expect(issues.map((issue) => issue.ruleId).sort()).toEqual([
      'runtime.score-out-of-range',
      'runtime.suspend-data-oversized',
    ])
  })

  it('re-reads the validator list on every call', () => {
    const adapter = new Scorm12Adapter('validation-test-reload')
    const issues: ValidationIssue[] = []
    const validators: RuntimeValidator[] = [outOfRangeScoreValidator]
    adapter.addMiddleware(
      createValidationMiddleware({
        getValidators: () => validators,
        onIssue: (issue) => issues.push(issue),
      }),
    )
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', '120')
    expect(issues).toHaveLength(1)

    // Profile toggles the rule off mid-session (Milestone 11 behavior).
    validators.length = 0
    adapter.setValue('cmi.core.score.raw', '200')
    expect(issues).toHaveLength(1)
  })

  it('includes the session id on runtime issues', () => {
    const { adapter, issues } = makeValidated([outOfRangeScoreValidator])
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', '999')

    expect(issues[0]?.sessionId).toBe('validation-test')
  })
})

describe('RUNTIME_VALIDATOR_BY_ID / getRuntimeValidator', () => {
  it('registers every validator under its rule id', () => {
    expect(RUNTIME_VALIDATOR_BY_ID['runtime.score-out-of-range']).toBe(
      outOfRangeScoreValidator,
    )
    expect(RUNTIME_VALIDATOR_BY_ID['runtime.suspend-data-oversized']).toBe(
      oversizedSuspendDataValidator,
    )
    expect(RUNTIME_VALIDATOR_BY_ID['runtime.missing-commit']).toBe(missingCommitValidator)
  })

  it('resolves known rule ids', () => {
    expect(getRuntimeValidator('runtime.score-out-of-range')).toBe(outOfRangeScoreValidator)
    expect(getRuntimeValidator('runtime.suspend-data-oversized')).toBe(
      oversizedSuspendDataValidator,
    )
    expect(getRuntimeValidator('runtime.missing-commit')).toBe(missingCommitValidator)
  })

  it('returns undefined for an unknown rule id', () => {
    expect(getRuntimeValidator('runtime.not-a-rule')).toBeUndefined()
  })

  it('the registry covers every rule id used by runtime profiles', () => {
    // Kept in the runtime half so this test needs no settings import. The
    // app-layer integration test (src/app/profileRuntime.test.ts) verifies
    // the full profile → validator resolution end to end.
    for (const ruleId of Object.keys(RUNTIME_VALIDATOR_BY_ID)) {
      expect(getRuntimeValidator(ruleId)).toBeDefined()
    }
  })
})
