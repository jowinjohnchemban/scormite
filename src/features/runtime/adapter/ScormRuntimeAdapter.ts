import type { Settings } from 'scorm-again'
import type { ApiCallContext, ApiCallResult, RuntimeMiddleware } from '../types'

/** A call parked while a breakpoint holds execution. */
interface PendingCall {
  ctx: ApiCallContext
  invoke: () => string
  /** Runs with the result once the call actually executes (immediately or on resume). */
  settle?: (result: string) => void
}

/**
 * scorm-again `Settings` keys that runtime profiles are allowed to tune.
 *
 * Verified against scorm-again 3.2.0's compiled output: `mastery_override`,
 * `score_overrides_status`, and `autoCompleteLessonStatus` are all read at
 * terminate time in scorm12.js (lesson_status derivation, stages 1–2) and
 * `mastery_override` is read by both constructors.
 *
 * `strict_errors` is deliberately absent — it appears only in DefaultSettings
 * in 3.2.0 and is never read by the API, so configuring it would silently do
 * nothing. Profiles must not be built on knobs that don't exist.
 */
export const PROFILE_SETTING_KEYS: readonly (keyof Settings)[] = [
  'mastery_override',
  'score_overrides_status',
  'autoCompleteLessonStatus',
]

/**
 * Abstract base class for SCORM runtime adapters.
 *
 * Subclasses implement the scorm-again wiring; this class owns the middleware
 * pipeline and the timing/error capture that wraps every call.
 */
export abstract class ScormRuntimeAdapter {
  protected readonly sessionId: string
  /** The settings the concrete adapter passed to its scorm-again API instance. */
  protected apiSettings: Partial<Settings>
  private readonly _middleware: RuntimeMiddleware[] = []
  private _paused = false
  private readonly _pendingCalls: PendingCall[] = []
  private readonly _pauseListeners = new Set<(paused: boolean) => void>()

  constructor(sessionId: string, apiSettings?: Partial<Settings>) {
    this.sessionId = sessionId
    this.apiSettings = apiSettings ?? {}
  }

  addMiddleware(mw: RuntimeMiddleware): void {
    this._middleware.push(mw)
  }

  /**
   * Apply a runtime profile's scorm-again overrides.
   *
   * Only `PROFILE_SETTING_KEYS` are applied — unknown keys are ignored, so a
   * profile cannot corrupt the API with a typo or an unsupported knob. The
   * overrides go to the live scorm-again instance (which reads them at call
   * time, e.g. status derivation at Terminate) and into `apiSettings` so a
   * later `resetApiIfNeeded` keeps the profile across SCO restarts.
   */
  configure(overrides: Record<string, unknown>): void {
    const next: Partial<Settings> = {}
    for (const key of PROFILE_SETTING_KEYS) {
      const value = overrides[key]
      if (value !== undefined) {
        ;(next as Record<string, unknown>)[key] = value
      }
    }
    this.apiSettings = { ...this.apiSettings, ...next }
    this.applyApiSettings(next)
  }

  /** Push settings onto the concrete scorm-again API instance. */
  protected abstract applyApiSettings(settings: Partial<Settings>): void

  /** True while a breakpoint is holding execution. */
  get isPaused(): boolean {
    return this._paused
  }

  /** Number of calls parked while paused, awaiting resume. */
  get pendingCallCount(): number {
    return this._pendingCalls.length
  }

  /** Subscribe to pause-state changes; returns an unsubscribe function. */
  onPauseChange(listener: (paused: boolean) => void): () => void {
    this._pauseListeners.add(listener)
    return () => this._pauseListeners.delete(listener)
  }

  /**
   * Apply every parked call, in order, and clear the paused state.
   *
   * Parked calls run through the same pipeline as normal ones (post hooks
   * fire, records emit) so the API monitor / timeline see the call at the
   * moment its value is actually applied.
   */
  resume(): void {
    if (!this._paused) return
    this._paused = false
    for (const listener of this._pauseListeners) listener(false)
    const pending = this._pendingCalls.splice(0)
    for (const call of pending) {
      const result = this.execute(call.ctx, call.invoke)
      call.settle?.(result)
    }
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

  /**
   * Runs `fn` through the middleware pipeline.
   *
   * When a pre-hook returns `pause` (or execution is already paused), the
   * call is parked instead of invoked — the value is NOT applied yet. The SCO
   * still gets a synchronous answer (SetValue/Commit are optimistic `'true'`
   * since they succeed on resume; reads return `'false'` because they have
   * genuinely not happened). `settle` runs with the real result once the call
   * executes, whether that is now or after `resume()`.
   */
  protected runCall(
    method: ApiCallContext['method'],
    fn: () => string,
    element?: string,
    value?: string,
    settle?: (result: string) => void,
  ): string {
    const ctx: ApiCallContext = {
      sessionId: this.sessionId,
      method,
      ...(element !== undefined ? { element } : {}),
      ...(value !== undefined ? { value } : {}),
    }

    // Execution is suspended by a breakpoint: park mutating calls so the SCO
    // cannot sneak a mutation past the pause. Reads execute immediately — they
    // have no side effect, and the SCO needs real values to render the
    // (frozen) state the breakpoint paused.
    if (this._paused && this.isMutating(ctx.method)) {
      this.park(ctx, fn, settle)
      return this.pausedAnswer(ctx)
    }

    for (const mw of this._middleware) {
      if (mw.pre?.(ctx) === 'pause') {
        this._paused = true
        for (const listener of this._pauseListeners) listener(true)
        this.park(ctx, fn, settle)
        return this.pausedAnswer(ctx)
      }
    }

    return this.execute(ctx, fn, settle)
  }

  /** Queue a call to run on resume (exactOptionalPropertyTypes-safe). */
  private park(
    ctx: ApiCallContext,
    invoke: () => string,
    settle?: (result: string) => void,
  ): void {
    this._pendingCalls.push(
      settle ? { ctx, invoke, settle } : { ctx, invoke },
    )
  }

  /** Mutating calls are deferred while paused; read-only calls pass through. */
  private isMutating(method: ApiCallContext['method']): boolean {
    return (
      method === 'SetValue' ||
      method === 'Commit' ||
      method === 'Initialize' ||
      method === 'Terminate'
    )
  }

  /** What the SCO-facing method returns while the call is parked. */
  private pausedAnswer(ctx: ApiCallContext): string {
    return ctx.method === 'SetValue' || ctx.method === 'Commit' ? 'true' : 'false'
  }

  /** Invoke `fn`, run post hooks, then hand the result to `settle`. */
  private execute(
    ctx: ApiCallContext,
    fn: () => string,
    settle?: (result: string) => void,
  ): string {
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

    settle?.(returnValue)

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
