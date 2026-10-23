/**
 * The audit's findings and coverage, and the test plan for a package.
 */

import { describe, expect, it } from 'vitest'
import type { ApiCallRecord, LaunchableItem } from '@/shared/types'
import { auditSession, buildTestPlan } from './audit'

const item = (identifier: string, extra: Partial<LaunchableItem> = {}): LaunchableItem => ({
  identifier,
  title: identifier.toUpperCase(),
  depth: 0,
  resourceIdentifier: `r-${identifier}`,
  scormType: 'sco',
  launchPath: `${identifier}.html`,
  launchData: {},
  ...extra,
})

const failure = (element: string): ApiCallRecord => ({
  id: element,
  sessionId: 's',
  timestamp: 0,
  method: 'SetValue',
  element,
  value: 'x',
  returnValue: 'false',
  durationMs: 0,
  errorCode: '406',
  errorString: 'Data Model Element Type Mismatch',
})

describe('auditSession', () => {
  const audit = auditSession({
    items: [item('a'), item('b'), item('c')],
    progress: {
      a: { completionStatus: 'completed', successStatus: 'passed', score: '90', location: '', time: '' },
      b: { completionStatus: 'incomplete', successStatus: 'failed', score: '40', location: '', time: '' },
    },
    issues: [
      {
        id: '1',
        severity: 'error',
        source: 'manifest',
        message: 'Missing launch file',
        ruleId: 'manifest.missing-launch-file',
      },
    ],
    apiCalls: [failure('cmi.score.raw'), failure('cmi.score.raw'), failure('cmi.location')],
    missingFiles: ['media/intro.mp4', 'media/intro.mp4'],
    pageAccessibility: ['1 image(s) have no alt attribute.'],
  })

  it('turns every problem into a finding, grouping repeated API failures and missing files', () => {
    expect(audit.summary).toEqual({ error: 2, warning: 3, info: 1 })
    expect(audit.findings.map((f) => f.area)).toEqual(['package', 'api', 'api', 'network', 'content', 'coverage'])
    expect(audit.findings[1]?.message).toBe(
      'SetValue cmi.score.raw failed 2× with error 406 (Data Model Element Type Mismatch).',
    )
    expect(audit.findings.find((f) => f.area === 'network')?.message).toContain('media/intro.mp4')
  })

  it('reports which items were launched, completed, passed, and failed', () => {
    expect(audit.coverage).toEqual({ items: 3, launched: 2, completed: 1, passed: 1, failed: 1 })
    expect(audit.findings.at(-1)?.message).toBe('1 of 3 item(s) not launched yet: C.')
    expect(audit.nextSteps[0]).toMatch(/not launched/)
  })
})

describe('buildTestPlan', () => {
  it('plans every item, with the failing path where the manifest sets a threshold', () => {
    const { steps } = buildTestPlan(
      [
        item('a', { launchData: { masteryScore: '80', dataFromLms: 'x' } }),
        item('b'),
        item('g', { scormType: 'asset' }),
      ],
      '1.2',
      false,
    )
    const goals = steps.map((s) => s.goal)
    expect(goals[0]).toBe('Review the package before running it.')
    expect(goals).toContain('Test the failing path of "A" (a).')
    expect(goals).toContain('Check launch data reaches "A" (a).')
    expect(goals).not.toContain('Test the failing path of "B" (b).')
    expect(goals).toContain('Open asset "G" (g).')
    expect(goals.at(-1)).toBe('Collect the findings.')
    expect(steps.find((s) => s.goal.startsWith('Take "A"'))?.check).toContain('mastery score 80')
    expect(steps.find((s) => s.goal.startsWith('Test resume'))?.check).toContain('cmi.core.entry')
  })

  it('adds a sequencing step for a sequenced SCORM 2004 course', () => {
    const { steps } = buildTestPlan([item('a')], '2004', true)
    expect(steps.some((s) => s.goal === 'Check the sequencing rules.')).toBe(true)
    expect(steps.find((s) => s.goal.startsWith('Test resume'))?.check).toContain('cmi.entry')
  })
})
