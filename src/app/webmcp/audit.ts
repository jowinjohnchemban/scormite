/**
 * The checks behind `audit_session` and the plan behind `get_test_plan`: pure
 * functions over the session's state, so an agent gets one structured answer
 * to "is anything wrong, and what is left to test?".
 */

import type { CmiSummary } from '@/app/course/summarizeCmi'
import type { ApiCallRecord, LaunchableItem, ValidationIssue } from '@/shared/types'

export type FindingSeverity = 'error' | 'warning' | 'info'

export interface Finding {
  severity: FindingSeverity
  area: 'package' | 'runtime' | 'api' | 'network' | 'content' | 'coverage'
  message: string
  suggestion?: string
}

export interface AuditInput {
  items: readonly LaunchableItem[]
  progress: Readonly<Record<string, CmiSummary>>
  issues: readonly ValidationIssue[]
  apiCalls: readonly ApiCallRecord[]
  /** Package files the course requested that were not in the package. */
  missingFiles: readonly string[]
  /** Accessibility findings on the running page, when one is running. */
  pageAccessibility: readonly string[] | null
}

export interface Audit {
  summary: Record<FindingSeverity, number>
  coverage: { items: number; launched: number; completed: number; passed: number; failed: number }
  findings: Finding[]
  nextSteps: string[]
}

const COMPLETE = new Set(['completed', 'passed'])

export function auditSession(input: AuditInput): Audit {
  const findings: Finding[] = []

  for (const issue of input.issues) {
    findings.push({
      severity: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
      area: issue.source === 'runtime' ? 'runtime' : 'package',
      message: `${issue.message}${issue.location ? ` (${issue.location})` : ''}`,
      suggestion: `Rule ${issue.ruleId} — see the SCORM support guide.`,
    })
  }

  // Failed API calls, grouped so a repeated mistake is one finding.
  const failures = new Map<string, { record: ApiCallRecord; count: number }>()
  for (const record of input.apiCalls) {
    if (!record.errorCode) continue
    const key = `${record.method}|${record.element ?? ''}|${record.errorCode}`
    const entry = failures.get(key)
    if (entry) entry.count++
    else failures.set(key, { record, count: 1 })
  }
  for (const { record, count } of failures.values()) {
    findings.push({
      severity: 'warning',
      area: 'api',
      message: `${record.method}${record.element ? ` ${record.element}` : ''} failed ${count}× with error ${record.errorCode}${record.errorString ? ` (${record.errorString})` : ''}.`,
      ...(record.diagnostic ? { suggestion: record.diagnostic } : {}),
    })
  }

  for (const path of new Set(input.missingFiles)) {
    findings.push({
      severity: 'error',
      area: 'network',
      message: `The course requested "${path}", which is not in the package.`,
      suggestion: 'Add the file to the package (and to the manifest), or fix the reference.',
    })
  }

  for (const problem of input.pageAccessibility ?? []) {
    findings.push({ severity: 'warning', area: 'content', message: `Running page: ${problem}` })
  }

  let launched = 0
  let completed = 0
  let passed = 0
  let failed = 0
  const notLaunched: string[] = []
  for (const item of input.items) {
    const summary = input.progress[item.identifier]
    if (!summary) {
      notLaunched.push(item.title || item.identifier)
      continue
    }
    launched++
    if (COMPLETE.has(summary.completionStatus)) completed++
    if (summary.successStatus === 'passed' || summary.completionStatus === 'passed') passed++
    if (summary.successStatus === 'failed' || summary.completionStatus === 'failed') failed++
  }
  if (notLaunched.length > 0) {
    findings.push({
      severity: 'info',
      area: 'coverage',
      message: `${notLaunched.length} of ${input.items.length} item(s) not launched yet: ${notLaunched.join(', ')}.`,
      suggestion: 'Launch each item (launch_item) and take it to the end.',
    })
  }

  const summary = { error: 0, warning: 0, info: 0 }
  for (const finding of findings) summary[finding.severity]++

  const nextSteps: string[] = []
  if (notLaunched.length > 0) nextSteps.push('Launch and complete the items not launched yet.')
  if (launched > 0)
    nextSteps.push('Test resume: relaunch_item on a part-finished item and check cmi entry and suspend data.')
  if (failed === 0 && launched > 0) {
    nextSteps.push('Test the failing path too: discard_and_restart (item) and answer wrongly.')
  }
  nextSteps.push('Export the evidence with get_report.')

  return {
    summary,
    coverage: { items: input.items.length, launched, completed, passed, failed },
    findings,
    nextSteps,
  }
}

export interface TestStep {
  goal: string
  tools: string[]
  check: string
}

/** A QA plan for this package: what to do with which tools, and what to check. */
export function buildTestPlan(
  items: readonly LaunchableItem[],
  scormVersion: string,
  sequenced: boolean,
): { steps: TestStep[] } {
  const v12 = scormVersion.startsWith('1.')
  const status = v12 ? 'cmi.core.lesson_status' : 'cmi.completion_status and cmi.success_status'
  const entry = v12 ? 'cmi.core.entry' : 'cmi.entry'
  const suspend = 'cmi.suspend_data'
  const steps: TestStep[] = [
    {
      goal: 'Review the package before running it.',
      tools: ['get_manifest', 'list_files', 'get_validation_issues'],
      check: 'No packaging errors; every item points at a resource whose launch file exists.',
    },
  ]

  for (const item of items) {
    const name = `"${item.title || item.identifier}" (${item.identifier})`
    if (item.scormType === 'asset') {
      steps.push({
        goal: `Open asset ${name}.`,
        tools: ['launch_item', 'read_sco_page', 'get_network'],
        check: 'It displays, and every file it requests is in the package. Assets do not report tracking data.',
      })
      continue
    }
    const { masteryScore, scaledPassingScore, completionThreshold, dataFromLms, maxTimeAllowed } = item.launchData
    const thresholds = [
      masteryScore && `mastery score ${masteryScore}`,
      scaledPassingScore && `passing score ${scaledPassingScore}`,
      completionThreshold && `completion threshold ${completionThreshold}`,
    ].filter(Boolean)
    steps.push({
      goal: `Take ${name} to the end as a learner.`,
      tools: ['launch_item', 'read_sco_page', 'interact_with_sco', 'get_cmi', 'get_api_log'],
      check: `${status} end as expected; Commit and Terminate are called; no failed API calls${thresholds.length ? `; the result respects the ${thresholds.join(', ')}` : ''}.`,
    })
    steps.push({
      goal: `Test resume of ${name}.`,
      tools: ['discard_and_restart', 'interact_with_sco', 'relaunch_item', 'get_cmi'],
      check: `Leave it part-way (suspend), relaunch: ${entry} is "resume" and ${suspend} and the location restore the learner's place.`,
    })
    if (thresholds.length) {
      steps.push({
        goal: `Test the failing path of ${name}.`,
        tools: ['discard_and_restart', 'interact_with_sco', 'get_cmi', 'get_validation_issues'],
        check:
          'A score below the threshold reports failed; check the runtime.status-overridden finding if the LMS rules changed the status.',
      })
    }
    if (dataFromLms || maxTimeAllowed) {
      steps.push({
        goal: `Check launch data reaches ${name}.`,
        tools: ['get_cmi'],
        check: `${dataFromLms ? 'cmi.launch_data matches the manifest' : ''}${dataFromLms && maxTimeAllowed ? '; ' : ''}${maxTimeAllowed ? 'the time limit is seeded' : ''}.`,
      })
    }
  }

  if (sequenced) {
    steps.push({
      goal: 'Check the sequencing rules.',
      tools: ['get_session', 'launch_item', 'navigate'],
      check:
        'Items the rules forbid are refused until their conditions are met; Previous / Next follow the rules; refused requests appear as warnings.',
    })
  }
  steps.push({
    goal: 'Review the content of each page.',
    tools: ['read_sco_page', 'read_file'],
    check:
      'Text is correct and consistent, images have alt text, controls have names, and nothing references missing media.',
  })
  steps.push({
    goal: 'Collect the findings.',
    tools: ['audit_session', 'get_report'],
    check: 'Every error and warning is explained or fixed; attach the report.',
  })
  return { steps }
}
