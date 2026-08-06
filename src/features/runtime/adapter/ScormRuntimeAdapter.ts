import type { ApiCallContext, ApiCallResult, RuntimeMiddleware } from '../types'

/**
 * Abstract base class for SCORM runtime adapters.
 *
 * Subclasses implement the scorm-again wiring; this class owns the middleware
 * pipeline and the timing/error capture that wraps every call.
 */
export abstract class ScormRuntimeAdapter {
  protected readonly sessionId: string
  private readonly _middleware: RuntimeMiddleware[] = []

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  addMiddleware(mw: RuntimeMiddleware): void {
    this._middleware.push(mw)
  }

  // ---------------------------------------------------------------------------
  // Template: wrap any API call through the middleware pipeline
  // ---------------------------------------------------------------------------

  protected runCall(
    method: ApiCallContext['method'],
    fn: () => string,
    element?: string,
    value?: string,
  ): string {
    const ctx: ApiCallContext = {
      sessionId: this.sessionId,
      method,
      ...(element !== undefined ? { element } : {}),
      ...(value !== undefined ? { value } : {}),
    }

    for (const mw of this._middleware) mw.pre?.(ctx)

    const t0 = performance.now()
    const returnValue = fn()
    const durationMs = performance.now() - t0

    const rawError = this.getLastError()
    const result: ApiCallResult = {
      ...ctx,
      returnValue,
      durationMs,
      ...(rawError ? { errorCode: rawError } : {}),
      timestamp: Date.now(),
    }

    for (const mw of this._middleware) mw.post?.(result)

    return returnValue
  }

  // ---------------------------------------------------------------------------
  // Unified SCORM interface (method names normalised — no LMS prefix)
  // ---------------------------------------------------------------------------

  abstract initialize(): string
  abstract terminate(): string
  abstract getValue(element: string): string
  abstract setValue(element: string, value: string): string
  abstract commit(): string
  abstract getLastError(): string
  abstract getErrorString(errorCode: string): string
  abstract getDiagnostic(errorCode: string): string

  /** Returns the current CMI data model as a flat key/value map. */
  abstract getFlattenedCmi(): Record<string, string>
}
