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
 * Middleware participates in the pre/post pipeline around every SCORM API
 * call.  Both hooks are optional — implement only what you need.
 */
export interface RuntimeMiddleware {
  /** Called before the underlying scorm-again method is invoked. */
  pre?(ctx: ApiCallContext): void
  /** Called after the underlying scorm-again method returns. */
  post?(result: ApiCallResult): void
}
