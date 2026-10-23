/**
 * Validation entity — a static (manifest) or runtime validation finding.
 * Owned by the validation feature (construction + mutation lives there);
 * type lives in shared so all features and the app layer can reference it
 * without violating the ESLint feature-boundary rules.
 */

export type ValidationSeverity = 'error' | 'warning' | 'suggestion'

/** `review`: recorded by an AI agent's content or logic review (WebMCP). */
export type ValidationSource = 'manifest' | 'runtime' | 'review'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  /** Static manifest analysis, a live session, or a recorded review. */
  source: ValidationSource
  message: string
  /**
   * Where the issue was found: a manifest element path, a CMI element path,
   * or the API method name for runtime issues.
   */
  location?: string
  /** Stable identifier of the rule that produced this issue. */
  ruleId: string
  /** Session id, when the issue came from a runtime session. */
  sessionId?: string
}
