import type { ScormApiMethod } from '@/shared/types'

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
