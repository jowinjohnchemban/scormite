import type { ValidationIssue, ValidationSeverity } from '@/shared/types'
import type { ApiCallResult, RuntimeMiddleware } from '../../types'
import { isScorePath } from '../cmiPaths'

/**
 * State the middleware tracks across calls, passed to every validator so
 * rules that need session history (e.g. "was there a Commit?") stay pure.
 */
export interface RuntimeValidatorContext {
  /** True when a Commit returned 'true' earlier in this session. */
  sawCommit: boolean
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
 * The app layer wires this up in `usePackageSession`.
 */
export interface ValidationMiddlewareOptions {
  /**
   * Live validators — re-read on every call so runtime profiles (Milestone
   * 11) can toggle which rules run without rebuilding the pipeline.
   */
  getValidators: () => RuntimeValidator[]
  /** Fired for every call that violates a validator. */
  onIssue: (issue: ValidationIssue) => void
}

/** SCORM caps suspend_data at 4096 characters (both 1.2 and 2004). */
export const SUSPEND_DATA_MAX_LENGTH = 4096

/**
 * SetValue on a score element with a value outside the valid 0–100 range
 * (or a non-numeric value). The runtime may reject these itself, but this
 * rule reports them regardless of the profile's leniency.
 */
export const outOfRangeScoreValidator: RuntimeValidator = {
  ruleId: 'runtime.score-out-of-range',
  severity: 'error',
  check(result) {
    if (result.method !== 'SetValue' || result.value === undefined || result.value === '') {
      return null
    }
    if (!isScorePath(result.element)) return null
    const numeric = Number(result.value)
    if (Number.isNaN(numeric)) {
      return `Score "${result.value}" is not a valid number.`
    }
    if (numeric < 0 || numeric > 100) {
      return `Score ${numeric} is out of range — SCORM expects a score between 0 and 100.`
    }
    return null
  },
}

/**
 * SetValue on `cmi.suspend_data` with a value longer than the SCORM limit —
 * a broken suspend_data is silently truncated or rejected by some LMSs.
 */
export const oversizedSuspendDataValidator: RuntimeValidator = {
  ruleId: 'runtime.suspend-data-oversized',
  severity: 'warning',
  check(result) {
    if (result.method !== 'SetValue' || result.element !== 'cmi.suspend_data') return null
    if (result.value !== undefined && result.value.length > SUSPEND_DATA_MAX_LENGTH) {
      return `suspend_data is ${result.value.length} characters — exceeds the ${SUSPEND_DATA_MAX_LENGTH}-character SCORM limit and may be truncated.`
    }
    return null
  },
}

/**
 * A course that terminates without ever committing may lose its final state.
 * SCORM 1.2 LMSs auto-commit on Finish, but 2004 leaves persistence to the
 * LMS — and either way a silent Terminate is a portability smell.
 */
export const missingCommitValidator: RuntimeValidator = {
  ruleId: 'runtime.missing-commit',
  severity: 'warning',
  check(result, ctx) {
    if (result.method !== 'Terminate') return null
    if (!ctx.sawCommit) {
      return 'Course terminated without a successful Commit — the final CMI state may not persist.'
    }
    return null
  },
}

/**
 * Registry of every runtime validator, keyed by `ruleId`. Runtime profiles
 * (Milestone 11) reference rules by id; the app layer resolves ids to
 * implementations through this map, keeping profile data (settings feature)
 * free of any runtime import.
 */
export const RUNTIME_VALIDATOR_BY_ID: Readonly<Record<string, RuntimeValidator>> = {
  [outOfRangeScoreValidator.ruleId]: outOfRangeScoreValidator,
  [oversizedSuspendDataValidator.ruleId]: oversizedSuspendDataValidator,
  [missingCommitValidator.ruleId]: missingCommitValidator,
}

/** Resolve a validator by rule id; `undefined` for unknown ids. */
export function getRuntimeValidator(ruleId: string): RuntimeValidator | undefined {
  return RUNTIME_VALIDATOR_BY_ID[ruleId]
}

/**
 * Runs the configured runtime validators against every completed API call
 * and pushes a `ValidationIssue` for each violation. Tracks the
 * session-scoped Commit state needed by the missing-commit rule.
 */
export function createValidationMiddleware(
  options: ValidationMiddlewareOptions,
): RuntimeMiddleware {
  let sawCommit = false

  return {
    post(result: ApiCallResult): void {
      if (result.method === 'Commit') {
        sawCommit = result.returnValue === 'true'
      }

      const ctx: RuntimeValidatorContext = { sawCommit }
      for (const validator of options.getValidators()) {
        const message = validator.check(result, ctx)
        if (message === null) continue
        options.onIssue({
          id: crypto.randomUUID(),
          severity: validator.severity,
          source: 'runtime',
          message,
          location: result.element ?? result.method,
          ruleId: validator.ruleId,
          ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
        })
      }
    },
  }
}
