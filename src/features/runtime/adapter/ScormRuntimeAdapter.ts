import type { Settings } from 'scorm-again'
import type { ApiCallContext, ApiCallResult, RuntimeMiddleware } from '../types'

/**
 * Abstract base class for SCORM runtime adapters.
 *
 * Subclasses implement the scorm-again wiring; this class owns the middleware
 * pipeline and the timing/error capture that wraps every call.
 */
export abstract class ScormRuntimeAdapter {
  protected readonly sessionId: string
  /** The settings the concrete adapter passed to its scorm-again API instance. */
  protected readonly apiSettings: Partial<Settings>
  private readonly _middleware: RuntimeMiddleware[] = []

  constructor(sessionId: string, apiSettings?: Partial<Settings>) {
    this.sessionId = sessionId
    this.apiSettings = apiSettings ?? {}
  }

  addMiddleware(mw: RuntimeMiddleware): void {
    this._middleware.push(mw)
  }

  /**
   * scorm-again API instances are single-session state machines: once the SCO
   * finishes (or is torn down without finishing), later Initialize calls fail
   * with error 101 ("LMS is already finished!").
   *
   * In Scormite the adapter outlives the SCO iframe — e.g. switching Basic ↔
   * Advanced mode unmounts the iframe (the SCO's onunload calls Finish) and a
   * fresh iframe then restarts the same course against the same adapter. Before
   * delegating Initialize we bring the API back to the NOT_INITIALIZED state
   * using scorm-again's own reset(settings). That keeps CMI values intact
   * (suspend_data, lesson_status, …), so the restart resumes like a real LMS
   * session instead of crashing on error 101.
   */
  protected resetApiIfNeeded(api: {
    isNotInitialized(): boolean
    reset(settings?: Partial<Settings>): void
  }): void {
    if (!api.isNotInitialized()) {
      api.reset(this.apiSettings)
    }
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
      // SCORM returns the string "0" when no error has occurred.
      ...(rawError && rawError !== '0' ? { errorCode: rawError } : {}),
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
