import type { ScormApiMethod, ScormVersion } from '@/shared/types'

/**
 * What an LMS would persist for one attempt of one SCO: scorm-again's
 * terminate-commit payload (the full `cmi` tree, with `total_time` already
 * accumulated). Feeding it back through `restoreAttempt` relaunches the SCO
 * the way a real LMS resumes it.
 */
export interface AttemptRecord {
  scormVersion: ScormVersion
  /** `{ cmi: { … } }` exactly as scorm-again renders it. */
  data: Record<string, unknown>
}

/**
 * SCORM 2004 navigation requests a SCO can leave in `adl.nav.request` for
 * the LMS to act on after Terminate. scorm-again parses the request and
 * raises it; the adapter forwards it as a `navigation-request` event.
 */
export type NavigationRequest =
  'continue' | 'previous' | 'choice' | 'jump' | 'exit' | 'exitAll' | 'abandon' | 'abandonAll'

export interface NavigationRequestEvent {
  sessionId: string
  request: NavigationRequest
  /** Target activity identifier for `choice` / `jump`. */
  target?: string
}

/** Context available to pre-call middleware hooks. */
export interface ApiCallContext {
  sessionId: string
  method: ScormApiMethod
  element?: string
  value?: string
}

/** Full result available to post-call middleware hooks. */
export interface ApiCallResult extends ApiCallContext {
  returnValue: string
  durationMs: number
  errorCode?: string
  /** scorm-again's explanation of `errorCode`. */
  errorString?: string
  /** scorm-again's diagnostic for `errorCode`, when it differs from `errorString`. */
  diagnostic?: string
  timestamp: number
}

/**
 * What a pre-call hook wants the pipeline to do with the call.
 * - `continue`: proceed with the call (default when a hook returns nothing).
 * - `pause`: hold execution — the call is parked and only runs on resume.
 */
export type MiddlewareDecision = 'continue' | 'pause'

/**
 * Middleware participates in the pre/post pipeline around every SCORM API
 * call.  Both hooks are optional — implement only what you need.
 */
export interface RuntimeMiddleware {
  /** Called before the underlying scorm-again method is invoked. */
  pre?(ctx: ApiCallContext): MiddlewareDecision | void
  /** Called after the underlying scorm-again method returns. */
  post?(result: ApiCallResult): void
}
