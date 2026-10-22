import type { Settings } from 'scorm-again'
import type { LearnerInfo, ManifestItemLaunchData, ScormVersion } from '@/shared/types'
import type { AttemptRecord, ApiCallContext, ApiCallResult, RuntimeMiddleware } from '../types'

/** The slice of scorm-again's API surface the LMS-side helpers below rely on. */
interface LmsDataApi {
  loadFromFlattenedJSON(json: Record<string, unknown>, CMIElement?: string): void
  loadFromJSON(json: Record<string, unknown>, CMIElement?: string): void
  renderCommitCMI(terminateCommit: boolean): unknown
  renderCMIToJSONObject(): unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Settings every adapter starts from. Scormite plays the LMS itself, so
 * scorm-again never POSTs commits anywhere, and the commit payload is kept as
 * a JSON tree so `exportAttempt` can round-trip it through `loadFromJSON`.
 */
export const LMS_BASE_SETTINGS: Partial<Settings> = {
  lmsCommitUrl: false,
  autocommit: false,
  dataCommitFormat: 'json',
  // Status rules follow SCORM Cloud, the compatibility benchmark: at Finish
  // a mastery score decides passed / failed when the SCO reported a score,
  // a status the SCO set itself is respected, and an unset status stays
  // incomplete instead of being auto-completed.
  mastery_override: true,
  score_overrides_status: false,
  autoCompleteLessonStatus: false,
}

/** A call parked while a breakpoint holds execution. */
interface PendingCall {
  ctx: ApiCallContext
  invoke: () => string
  /** Runs with the result once the call actually executes (immediately or on resume). */
  settle?: (result: string) => void
}

/**
 * Abstract base class for SCORM runtime adapters.
 *
 * Subclasses implement the scorm-again wiring; this class owns the middleware
 * pipeline and the timing/error capture that wraps every call.
 */
export abstract class ScormRuntimeAdapter {
  readonly sessionId: string
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
   * Drop every held call and leave the paused state without applying them —
   * for when the SCO they belong to is unloaded. Applying them later would
   * write one SCO's data into the next SCO's runtime.
   */
  discardHeldCalls(): number {
    const dropped = this._pendingCalls.splice(0).length
    if (this._paused) {
      this._paused = false
      for (const listener of this._pauseListeners) listener(false)
    }
    return dropped
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
  protected resetApiIfNeeded(api: { isNotInitialized(): boolean; reset(settings?: Partial<Settings>): void }): void {
    if (!api.isNotInitialized()) {
      api.reset(this.apiSettings)
      this.afterApiReset()
    }
  }

  /**
   * scorm-again's reset() also clears every listener registered with
   * `api.on()`; subclasses re-register theirs here.
   */
  protected afterApiReset(): void {}

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
      return this.pausedAnswer()
    }

    for (const mw of this._middleware) {
      if (mw.pre?.(ctx) === 'pause') {
        this._paused = true
        for (const listener of this._pauseListeners) listener(true)
        this.park(ctx, fn, settle)
        return this.pausedAnswer()
      }
    }

    return this.execute(ctx, fn, settle)
  }

  /** Queue a call to run on resume (exactOptionalPropertyTypes-safe). */
  private park(ctx: ApiCallContext, invoke: () => string, settle?: (result: string) => void): void {
    this._pendingCalls.push(settle ? { ctx, invoke, settle } : { ctx, invoke })
  }

  /** Mutating calls are deferred while paused; read-only calls pass through. */
  private isMutating(method: ApiCallContext['method']): boolean {
    return method === 'SetValue' || method === 'Commit' || method === 'Initialize' || method === 'Terminate'
  }

  /**
   * What the SCO receives for a parked call. The SCORM API is synchronous —
   * JavaScript cannot block the SCO until the tester resumes — so a parked
   * mutation answers "true" now and really runs, in order, on resume (its
   * actual result then appears in the API log). Answering "false" would make
   * the course believe the call failed and change what is being debugged.
   */
  private pausedAnswer(): string {
    return 'true'
  }

  /**
   * scorm-again's own explanation of an error code. GetErrorString and
   * GetDiagnostic only read the API's error state, so asking does not
   * disturb what the SCO will see from its own GetLastError.
   */
  private describeError(errorCode: string): Pick<ApiCallResult, 'errorCode' | 'errorString' | 'diagnostic'> {
    const errorString = this.getErrorString(errorCode)
    const diagnostic = this.getDiagnostic(errorCode)
    return {
      errorCode,
      ...(errorString ? { errorString } : {}),
      ...(diagnostic && diagnostic !== errorString ? { diagnostic } : {}),
    }
  }

  /** Invoke `fn`, run post hooks, then hand the result to `settle`. */
  private execute(ctx: ApiCallContext, fn: () => string, settle?: (result: string) => void): string {
    const t0 = performance.now()
    const returnValue = fn()
    const durationMs = performance.now() - t0

    const rawError = this.getLastError()
    const result: ApiCallResult = {
      ...ctx,
      returnValue,
      durationMs,
      // SCORM returns the string "0" when no error has occurred.
      ...(rawError && rawError !== '0' ? this.describeError(rawError) : {}),
      timestamp: Date.now(),
    }

    for (const mw of this._middleware) mw.post?.(result)

    settle?.(returnValue)

    return returnValue
  }

  // ---------------------------------------------------------------------------
  // LMS-side data: what an LMS supplies before launch and stores after it
  // ---------------------------------------------------------------------------

  abstract readonly scormVersion: ScormVersion

  /** The scorm-again instance, as seen by the LMS-side helpers. */
  protected abstract get lmsApi(): LmsDataApi

  /**
   * Version-specific mapping of manifest launch data to CMI elements, plus
   * whatever an LMS always provides (e.g. `credit`).
   */
  protected abstract launchDataElements(data: ManifestItemLaunchData): Record<string, string | undefined>

  /** Version-specific learner elements (ID and name). */
  protected abstract learnerElements(learner: LearnerInfo): Record<string, string>

  /**
   * Report the learner, as an LMS does for its signed-in user. Called after
   * any restored attempt, so the current learner wins over a stored one.
   */
  seedLearner(learner: LearnerInfo): void {
    this.loadElements(this.learnerElements(learner))
  }

  private loadElements(elements: Record<string, string | undefined>): void {
    for (const [element, value] of Object.entries(elements)) {
      if (value === undefined || value === '') continue
      try {
        this.lmsApi.loadFromFlattenedJSON({ [element]: value })
      } catch {
        // scorm-again rejects values that violate the data model; the SCO
        // then simply sees the element's default, as it would on an LMS.
      }
    }
  }

  /**
   * Version-specific: the data a relaunch starts from, given the stored
   * attempt — or `null` when the version's rules start a new attempt with
   * fresh data instead.
   */
  protected abstract resumeData(cmi: Record<string, unknown>): Record<string, unknown> | null

  /**
   * Seed the manifest's per-item launch data (launch_data, mastery score,
   * completion threshold, …) before the SCO initializes, the way an LMS
   * does. Each element loads separately so one malformed manifest value
   * cannot keep the others out.
   */
  seedLaunchData(data: ManifestItemLaunchData): void {
    this.loadElements(this.launchDataElements(data))
  }

  /**
   * Snapshot this attempt as an LMS would store it at the end of the
   * session: scorm-again's terminate-commit payload, including the
   * accumulated `total_time`.
   */
  exportAttempt(): AttemptRecord {
    const rendered = this.lmsApi.renderCommitCMI(true)
    const data = isRecord(rendered) ? rendered : this.lmsApi.renderCMIToJSONObject()
    return {
      scormVersion: this.scormVersion,
      data: structuredClone(isRecord(data) ? data : {}),
    }
  }

  /**
   * Load a previously stored attempt before Initialize, so the SCO continues
   * with its suspend_data, location, score, objectives, and interactions —
   * when the SCORM version says the attempt continues (see `resumeData`).
   * Returns whether stored data was restored.
   */
  restoreAttempt(record: AttemptRecord): boolean {
    if (record.scormVersion !== this.scormVersion) return false
    const cmi = record.data['cmi']
    if (!isRecord(cmi)) return false
    const data = this.resumeData(structuredClone(cmi))
    if (!data) return false
    try {
      this.lmsApi.loadFromJSON({ cmi: data })
      return true
    } catch {
      // A corrupt record degrades to a fresh attempt rather than a crash.
      return false
    }
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
