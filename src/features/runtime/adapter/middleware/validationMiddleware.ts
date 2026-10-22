import type { ScormEdition, ScormVersion, ValidationIssue, ValidationSeverity } from '@/shared/types'
import type { ApiCallResult, RuntimeMiddleware } from '../../types'
import { isScorePath } from '../cmiPaths'

/**
 * State the middleware tracks across calls, passed to every validator so
 * rules that need session history (e.g. "was there a Commit?") stay pure.
 */
export interface RuntimeValidatorContext {
  scormVersion: ScormVersion
  /** Character limit of cmi.suspend_data for this package's SCORM edition. */
  suspendDataLimit: number
  /** True when a Commit returned 'true' earlier in this session. */
  sawCommit: boolean
  /** The status values the SCO itself last set this session, by element. */
  statusSetBySco: Readonly<Record<string, string>>
  /** The current data model, read without going through the API log. */
  readCmi: () => Record<string, string>
}

/**
 * One runtime validation rule. Pure by construction — `check` inspects a
 * single completed call (plus middleware-tracked context) and returns a
 * message when the rule fires, or null when the call is fine.
 */
export interface RuntimeValidator {
  ruleId: string
  severity: ValidationSeverity
  check(result: ApiCallResult, ctx: RuntimeValidatorContext): string | null
}

/**
 * Dependencies injected at creation time so the middleware never imports the
 * validation feature (boundary rule: features may not reach into each other).
 * The app layer wires this up when it builds a SCO's runtime.
 */
export interface ValidationMiddlewareOptions {
  scormVersion: ScormVersion
  /** SCORM 2004 edition, when known — it sets the suspend_data limit. */
  scormEdition?: ScormEdition
  /** Defaults to every rule in `RUNTIME_VALIDATORS`. */
  validators?: readonly RuntimeValidator[]
  /** Fired for every call that violates a validator. */
  onIssue: (issue: ValidationIssue) => void
  /** Reads the runtime's current data model, for rules that compare against it. */
  readCmi?: () => Record<string, string>
}

/**
 * Smallest permitted maximum of cmi.suspend_data: 4096 characters in SCORM
 * 1.2, 4000 in SCORM 2004 2nd / 3rd Edition, 64000 in 4th Edition. An
 * unknown 2004 edition uses the stricter 4000 — what older LMSs enforce.
 */
export function suspendDataLimit(version: ScormVersion, edition?: ScormEdition): number {
  if (version === '1.2') return 4096
  return edition === '4th' ? 64000 : 4000
}

/**
 * SCORM 1.2 defines every `*.score.raw` as a number from 0 to 100. SCORM
 * 2004 does not bound `score.raw` (only `score.scaled`, which the runtime
 * itself rejects outside -1…1), so the rule only applies to 1.2.
 */
export const outOfRangeScoreValidator: RuntimeValidator = {
  ruleId: 'runtime.score-out-of-range',
  severity: 'error',
  check(result, ctx) {
    if (ctx.scormVersion !== '1.2') return null
    if (result.method !== 'SetValue' || result.value === undefined || result.value === '') {
      return null
    }
    if (!isScorePath(result.element)) return null
    const numeric = Number(result.value)
    if (Number.isNaN(numeric)) {
      return `Score "${result.value}" is not a valid number.`
    }
    if (numeric < 0 || numeric > 100) {
      return `Score ${numeric} is out of range — SCORM 1.2 scores must be between 0 and 100.`
    }
    return null
  },
}

/**
 * SetValue on `cmi.suspend_data` with a value longer than the version's
 * limit — LMSs truncate or reject it, and the course then cannot resume.
 */
export const oversizedSuspendDataValidator: RuntimeValidator = {
  ruleId: 'runtime.suspend-data-oversized',
  severity: 'warning',
  check(result, ctx) {
    if (result.method !== 'SetValue' || result.element !== 'cmi.suspend_data') return null
    if (result.value !== undefined && result.value.length > ctx.suspendDataLimit) {
      return `suspend_data is ${result.value.length} characters — exceeds this package's ${ctx.suspendDataLimit}-character SCORM limit and may be truncated.`
    }
    return null
  },
}

/**
 * A course that terminates without ever committing may lose its final state
 * on LMSs that only persist on Commit — a portability smell either way.
 */
export const missingCommitValidator: RuntimeValidator = {
  ruleId: 'runtime.missing-commit',
  severity: 'warning',
  check(result, ctx) {
    if (result.method !== 'Terminate') return null
    if (!ctx.sawCommit) {
      return 'Course terminated without a successful Commit — the final CMI state may not persist on every LMS.'
    }
    return null
  },
}

/** Status elements an LMS evaluates on exit, by SCORM version. */
const LMS_EVALUATED_STATUS: Record<ScormVersion, readonly string[]> = {
  '1.2': ['cmi.core.lesson_status'],
  '2004': ['cmi.completion_status', 'cmi.success_status'],
}

/**
 * The status the LMS records differs from the one the SCO last set. The
 * runtime applies the LMS's rules on exit — the SCORM 1.2 mastery score, the
 * SCORM 2004 completion threshold and passing score — so a course that
 * "passes" in its authoring tool can still be recorded as failed. This names
 * the rule that changed it.
 */
export const statusOverriddenValidator: RuntimeValidator = {
  ruleId: 'runtime.status-overridden',
  severity: 'warning',
  check(result, ctx) {
    if (result.method !== 'Terminate' || result.returnValue !== 'true') return null
    const cmi = ctx.readCmi()
    const changes = LMS_EVALUATED_STATUS[ctx.scormVersion].flatMap((element) => {
      const reported = ctx.statusSetBySco[element]
      const recorded = cmi[element] ?? ''
      return reported === undefined || reported === recorded
        ? []
        : [{ element, text: `${element} is "${recorded}" — the SCO set "${reported}"` }]
    })
    if (changes.length === 0) return null
    const reasons = changes.flatMap(({ element }) => {
      const reason = statusRuleReason(element, cmi)
      return reason ? [reason] : []
    })
    return [`The LMS changed the status on exit: ${changes.map((c) => c.text).join('; ')}.`, ...reasons].join(' ')
  },
}

/** Why the LMS's rules produce the recorded value of a status element, when a rule applies. */
function statusRuleReason(element: string, cmi: Record<string, string>): string | null {
  const below = (value: string, limit: string) => Number(value) < Number(limit)
  if (element === 'cmi.core.lesson_status') {
    const score = cmi['cmi.core.score.raw'] ?? ''
    const mastery = cmi['cmi.student_data.mastery_score'] ?? ''
    if (score === '' || mastery === '') return null
    return `Score ${score} is ${below(score, mastery) ? 'below' : 'at or above'} the manifest's mastery score of ${mastery} (adlcp:masteryscore).`
  }
  if (element === 'cmi.success_status') {
    const passing = cmi['cmi.scaled_passing_score'] ?? ''
    if (passing === '') return null
    const scaled = cmi['cmi.score.scaled'] ?? ''
    if (scaled === '')
      return `The manifest sets a passing score of ${passing} (imsss:minNormalizedMeasure), and the SCO reported no cmi.score.scaled.`
    return `Scaled score ${scaled} is ${below(scaled, passing) ? 'below' : 'at or above'} the manifest's passing score of ${passing} (imsss:minNormalizedMeasure).`
  }
  if (element === 'cmi.completion_status') {
    const threshold = cmi['cmi.completion_threshold'] ?? ''
    if (threshold === '') return null
    const progress = cmi['cmi.progress_measure'] ?? ''
    if (progress === '')
      return `The manifest sets a completion threshold of ${threshold} (adlcp:completionThreshold), and the SCO reported no cmi.progress_measure.`
    return `Progress ${progress} is ${below(progress, threshold) ? 'below' : 'at or above'} the manifest's completion threshold of ${threshold} (adlcp:completionThreshold).`
  }
  return null
}

/** Every runtime rule, in reporting order. */
export const RUNTIME_VALIDATORS: readonly RuntimeValidator[] = [
  outOfRangeScoreValidator,
  oversizedSuspendDataValidator,
  missingCommitValidator,
  statusOverriddenValidator,
]

/**
 * Runs the runtime validators against every completed API call and pushes a
 * `ValidationIssue` for each violation. Tracks the session-scoped state the
 * rules need: whether a Commit succeeded, and the statuses the SCO set.
 */
export function createValidationMiddleware(options: ValidationMiddlewareOptions): RuntimeMiddleware {
  const validators = options.validators ?? RUNTIME_VALIDATORS
  const limit = suspendDataLimit(options.scormVersion, options.scormEdition)
  const statusElements = new Set(LMS_EVALUATED_STATUS[options.scormVersion])
  const readCmi = options.readCmi ?? (() => ({}))
  let sawCommit = false
  let statusSetBySco: Record<string, string> = {}

  return {
    post(result: ApiCallResult): void {
      if (result.method === 'Commit' && result.returnValue === 'true') sawCommit = true
      // A fresh Initialize starts a new session for the session-scoped rules.
      if (result.method === 'Initialize') {
        sawCommit = false
        statusSetBySco = {}
      }
      if (
        result.method === 'SetValue' &&
        result.returnValue === 'true' &&
        result.element !== undefined &&
        result.value !== undefined &&
        statusElements.has(result.element)
      ) {
        statusSetBySco = { ...statusSetBySco, [result.element]: result.value }
      }

      const ctx: RuntimeValidatorContext = {
        scormVersion: options.scormVersion,
        suspendDataLimit: limit,
        sawCommit,
        statusSetBySco,
        readCmi,
      }
      for (const validator of validators) {
        const message = validator.check(result, ctx)
        if (message === null) continue
        options.onIssue({
          id: crypto.randomUUID(),
          severity: validator.severity,
          source: 'runtime',
          message,
          location: result.element ?? result.method,
          ruleId: validator.ruleId,
          sessionId: result.sessionId,
        })
      }
    },
  }
}
