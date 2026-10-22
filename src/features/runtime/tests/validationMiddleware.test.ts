/**
 * Runtime validation rules and the middleware that runs them on every
 * completed API call.
 */

import { describe, expect, it } from 'vitest'
import type { ValidationIssue } from '@/shared/types'
import {
  createValidationMiddleware,
  missingCommitValidator,
  outOfRangeScoreValidator,
  oversizedSuspendDataValidator,
  statusOverriddenValidator,
  suspendDataLimit,
  type RuntimeValidatorContext,
} from '../adapter/middleware/validationMiddleware'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { Scorm2004Adapter } from '../adapter/Scorm2004Adapter'
import type { ApiCallResult } from '../types'

function call(overrides: Partial<ApiCallResult>): ApiCallResult {
  return { sessionId: 's1', method: 'SetValue', returnValue: 'true', durationMs: 0, timestamp: 0, ...overrides }
}

const NO_SESSION = { sawCommit: false, statusSetBySco: {}, readCmi: () => ({}) }
const CTX_12: RuntimeValidatorContext = { scormVersion: '1.2', suspendDataLimit: 4096, ...NO_SESSION }
const CTX_2004: RuntimeValidatorContext = { scormVersion: '2004', suspendDataLimit: 4000, ...NO_SESSION }

describe('outOfRangeScoreValidator', () => {
  it('flags SCORM 1.2 scores outside 0–100 and non-numbers', () => {
    expect(outOfRangeScoreValidator.check(call({ element: 'cmi.core.score.raw', value: '101' }), CTX_12)).toMatch(
      /out of range/,
    )
    expect(
      outOfRangeScoreValidator.check(call({ element: 'cmi.objectives.0.score.raw', value: '-1' }), CTX_12),
    ).toMatch(/out of range/)
    expect(outOfRangeScoreValidator.check(call({ element: 'cmi.core.score.raw', value: 'abc' }), CTX_12)).toMatch(
      /not a valid number/,
    )
    expect(outOfRangeScoreValidator.check(call({ element: 'cmi.core.score.raw', value: '85.5' }), CTX_12)).toBeNull()
  })

  it('does not flag SCORM 2004 raw scores, which have no fixed range', () => {
    expect(outOfRangeScoreValidator.check(call({ element: 'cmi.score.raw', value: '150' }), CTX_2004)).toBeNull()
  })

  it('ignores other elements and methods', () => {
    expect(
      outOfRangeScoreValidator.check(call({ element: 'cmi.core.lesson_location', value: '500' }), CTX_12),
    ).toBeNull()
    expect(
      outOfRangeScoreValidator.check(call({ method: 'GetValue', element: 'cmi.core.score.raw' }), CTX_12),
    ).toBeNull()
  })
})

describe('suspend_data limits', () => {
  it('uses the limit of the SCORM version and edition', () => {
    expect(suspendDataLimit('1.2')).toBe(4096)
    expect(suspendDataLimit('2004', '3rd')).toBe(4000)
    expect(suspendDataLimit('2004', '4th')).toBe(64000)
    expect(suspendDataLimit('2004')).toBe(4000)
  })

  it('flags suspend_data longer than the limit only', () => {
    const at = call({ element: 'cmi.suspend_data', value: 'x'.repeat(4000) })
    const over = call({ element: 'cmi.suspend_data', value: 'x'.repeat(4001) })
    expect(oversizedSuspendDataValidator.check(at, CTX_2004)).toBeNull()
    expect(oversizedSuspendDataValidator.check(over, CTX_2004)).toMatch(/4001 characters/)
  })
})

describe('createValidationMiddleware', () => {
  function run(calls: ApiCallResult[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const mw = createValidationMiddleware({ scormVersion: '1.2', onIssue: (i) => issues.push(i) })
    for (const result of calls) mw.post?.(result)
    return issues
  }

  it('reports a Terminate without any successful Commit', () => {
    const issues = run([call({ method: 'Initialize' }), call({ method: 'Terminate' })])
    expect(issues.map((i) => i.ruleId)).toEqual([missingCommitValidator.ruleId])
    expect(issues[0]).toMatchObject({ source: 'runtime', severity: 'warning', location: 'Terminate', sessionId: 's1' })
  })

  it('keeps a successful Commit even if a later Commit fails', () => {
    const issues = run([
      call({ method: 'Initialize' }),
      call({ method: 'Commit', returnValue: 'true' }),
      call({ method: 'Commit', returnValue: 'false' }),
      call({ method: 'Terminate' }),
    ])
    expect(issues).toEqual([])
  })

  it('starts a fresh commit check on each Initialize', () => {
    const issues = run([
      call({ method: 'Initialize' }),
      call({ method: 'Commit' }),
      call({ method: 'Terminate' }),
      call({ method: 'Initialize' }),
      call({ method: 'Terminate' }),
    ])
    expect(issues.map((i) => i.ruleId)).toEqual([missingCommitValidator.ruleId])
  })

  it('uses the edition-specific suspend_data limit', () => {
    const issues: ValidationIssue[] = []
    const mw = createValidationMiddleware({ scormVersion: '2004', scormEdition: '4th', onIssue: (i) => issues.push(i) })
    mw.post?.(call({ element: 'cmi.suspend_data', value: 'x'.repeat(5000) }))
    expect(issues).toEqual([])
  })
})

describe('statusOverriddenValidator', () => {
  /** Runs a SCO session against a real runtime with the middleware installed. */
  function session(adapter: Scorm12Adapter | Scorm2004Adapter, sco: () => void): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    adapter.addMiddleware(
      createValidationMiddleware({
        scormVersion: adapter.scormVersion,
        validators: [statusOverriddenValidator],
        onIssue: (i) => issues.push(i),
        readCmi: () => adapter.getFlattenedCmi(),
      }),
    )
    adapter.initialize()
    sco()
    adapter.commit()
    adapter.terminate()
    return issues
  }

  it('explains a SCORM 1.2 status the mastery score overrode', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({ masteryScore: '100' })
    const issues = session(adapter, () => {
      adapter.setValue('cmi.core.lesson_status', 'incomplete')
      adapter.setValue('cmi.core.score.raw', '50')
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toBe(
      'The LMS changed the status on exit: cmi.core.lesson_status is "failed" — the SCO set "incomplete". ' +
        "Score 50 is below the manifest's mastery score of 100 (adlcp:masteryscore).",
    )
  })

  it('stays quiet when the recorded status is the one the SCO set', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({ masteryScore: '80' })
    expect(
      session(adapter, () => {
        adapter.setValue('cmi.core.score.raw', '90')
        adapter.setValue('cmi.core.lesson_status', 'passed')
      }),
    ).toEqual([])
  })

  it('does not report a status the SCO never set', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({ masteryScore: '80' })
    expect(session(adapter, () => adapter.setValue('cmi.core.score.raw', '40'))).toEqual([])
  })

  it('explains a SCORM 2004 success status the passing score decided', () => {
    const adapter = new Scorm2004Adapter('s1')
    adapter.seedLaunchData({ scaledPassingScore: '0.8' })
    const issues = session(adapter, () => {
      adapter.setValue('cmi.success_status', 'passed')
      adapter.setValue('cmi.score.scaled', '0.5')
    })
    expect(issues[0]?.message).toMatch(/cmi.success_status is "failed" — the SCO set "passed"/)
    expect(issues[0]?.message).toMatch(/Scaled score 0.5 is below the manifest's passing score of 0.8/)
  })
})
