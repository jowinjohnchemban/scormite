/**
 * Reduces a flattened CMI map to the handful of values a tester reads at a
 * glance: completion, success, score, location, time.
 *
 * SCORM 1.2 folds completion and success into a single
 * `cmi.core.lesson_status`; this splits it so both versions answer the same
 * two questions ("is it complete?", "did it pass?").
 */

import type { ScormVersion } from '@/shared/types'

export interface CmiSummary {
  completionStatus: string
  successStatus: string
  /** Raw score, or the scaled score when no raw score was reported. */
  score: string
  location: string
  /** Accumulated total time when known, else the current session time. */
  time: string
}

export const EMPTY_CMI_SUMMARY: CmiSummary = {
  completionStatus: 'not attempted',
  successStatus: 'unknown',
  score: '',
  location: '',
  time: '',
}

const PASS_FAIL_12 = new Set(['passed', 'failed'])

export function summarizeCmi(cmi: Record<string, string>, version: ScormVersion): CmiSummary {
  if (version === '1.2') {
    const status = cmi['cmi.core.lesson_status'] || 'not attempted'
    return {
      completionStatus: status,
      successStatus: PASS_FAIL_12.has(status) ? status : 'unknown',
      score: cmi['cmi.core.score.raw'] ?? '',
      location: cmi['cmi.core.lesson_location'] ?? '',
      time: nonZeroTime(cmi['cmi.core.total_time']) || nonZeroTime(cmi['cmi.core.session_time']),
    }
  }
  return {
    completionStatus: cmi['cmi.completion_status'] || 'unknown',
    successStatus: cmi['cmi.success_status'] || 'unknown',
    score: cmi['cmi.score.raw'] || cmi['cmi.score.scaled'] || '',
    location: cmi['cmi.location'] ?? '',
    time: nonZeroTime(cmi['cmi.total_time']) || nonZeroTime(cmi['cmi.session_time']),
  }
}

/** Zero durations (`0000:00:00`, `PT0S`, …) read as "no time yet". */
function nonZeroTime(value: string | undefined): string {
  if (!value) return ''
  return /[1-9]/.test(value) ? value : ''
}

export type ProgressTone = 'passed' | 'failed' | 'completed' | 'in-progress' | 'not-started'

/** One status for the outline icon, from the two summary statuses. */
export function progressTone(summary: CmiSummary | undefined): ProgressTone {
  if (!summary) return 'not-started'
  if (summary.successStatus === 'passed') return 'passed'
  if (summary.successStatus === 'failed') return 'failed'
  if (summary.completionStatus === 'completed') return 'completed'
  if (summary.completionStatus === 'incomplete' || summary.completionStatus === 'browsed') {
    return 'in-progress'
  }
  return 'not-started'
}
