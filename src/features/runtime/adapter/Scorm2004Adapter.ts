import { Scorm2004API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import type {
  ActivityDefinition,
  LearnerInfo,
  HideLmsUiToken,
  ManifestItemLaunchData,
  SequencingDefinition,
} from '@/shared/types'
import { LMS_BASE_SETTINGS, ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { SequencingConfigBuilder } from './sequencing/SequencingConfigBuilder'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { NavigationRequest } from '../types'

/**
 * scorm-again raises one listener event per navigation request it parses out
 * of `adl.nav.request` at Terminate — when no sequencing engine handled it.
 */
const NAVIGATION_EVENTS: readonly (readonly [string, NavigationRequest])[] = [
  ['SequenceNext', 'continue'],
  ['SequencePrevious', 'previous'],
  ['SequenceChoice', 'choice'],
  ['SequenceJump', 'jump'],
  ['SequenceExit', 'exit'],
  ['SequenceExitAll', 'exitAll'],
  ['SequenceAbandon', 'abandon'],
  ['SequenceAbandonAll', 'abandonAll'],
]

/** Navigation requests the LMS itself may issue to the sequencing engine. */
export type SequencingRequest =
  | 'start'
  | 'resumeAll'
  | 'continue'
  | 'previous'
  | 'choice'
  | 'jump'
  | 'exit'
  | 'exitAll'
  | 'suspendAll'
  | 'abandon'
  | 'abandonAll'
  | 'retry'
  | 'retryAll'

/** What the engine allows right now — drives the player's navigation UI. */
export interface NavigationState {
  canContinue: boolean
  canPrevious: boolean
  /** Activity ids a `choice` request may target. */
  choices: string[]
  /** LMS controls the delivered activity asks the player to hide. */
  hiddenControls: HideLmsUiToken[]
}

/** The engine's tracking status for one activity (rolled up for clusters). */
export interface ActivityStatus {
  completionStatus: string
  successStatus: string
  score: number | null
}

export interface SequencingOptions {
  activityTree: ActivityDefinition
  collections?: Record<string, SequencingDefinition>
}

type OverallSequencingProcess = NonNullable<
  ReturnType<NonNullable<ReturnType<Scorm2004API['getSequencingService']>>['getOverallSequencingProcess']>
>
type DeliveredActivity = Parameters<OverallSequencingProcess['getEffectiveHideLmsUi']>[0]

export class Scorm2004Adapter extends ScormRuntimeAdapter {
  readonly scormVersion = '2004' as const
  readonly api: Scorm2004API
  /** Sequencing the manifest declares that the engine will not evaluate. */
  readonly sequencingWarnings: readonly string[]
  private readonly sequenced: boolean
  private lastDelivered: DeliveredActivity = null
  /** Id delivered in the current request; scorm-again reports each delivery twice. */
  private deliveredThisRound: string | null = null
  /** The navigation request the engine is processing, for error messages. */
  private lastRequest: string | null = null
  /** True while the LMS (this adapter's caller) is issuing a request. */
  private lmsRequest = false

  /**
   * Without `sequencing`, navigation requests surface as `navigation-request`
   * events for the app to resolve in flow order. With it, scorm-again's
   * SCORM 2004 sequencing engine owns navigation and announces each SCO to
   * deliver as an `activity-delivered` event; the same runtime then serves
   * every SCO of the course, reset between deliveries.
   */
  constructor(sessionId: string, settings?: Partial<Settings>, sequencing?: SequencingOptions) {
    const apiSettings: Partial<Settings> = { ...LMS_BASE_SETTINGS, ...settings }
    super(sessionId, apiSettings)

    let warnings: string[] = []
    let sequencingSettings: Settings['sequencing']
    if (sequencing) {
      const built = new SequencingConfigBuilder().build(sequencing.activityTree, sequencing.collections)
      warnings = built.warnings
      sequencingSettings = {
        ...built.settings,
        eventListeners: {
          onActivityDelivery: (activity) => this.handleDelivery(activity),
          onNavigationRequest: (request, target) => {
            this.lastRequest = target ? `${request} ${target}` : request
          },
          onSequencingSessionEnd: (data) =>
            runtimeEvents.emit('sequencing-session-end', {
              sessionId: this.sessionId,
              reason: data.navigationRequest ?? data.reason,
            }),
          onSequencingError: (error, context) => this.handleSequencingError(error, context),
        },
      }
    }
    this.sequencingWarnings = warnings
    this.sequenced = sequencingSettings !== undefined
    this.api = new Scorm2004API(sequencingSettings ? { ...apiSettings, sequencing: sequencingSettings } : apiSettings)
    this.attachApiListeners()
  }

  get isSequenced(): boolean {
    return this.sequenced
  }

  protected get lmsApi() {
    return this.api
  }

  protected override afterApiReset(): void {
    this.attachApiListeners()
  }

  private attachApiListeners(): void {
    for (const [event, request] of NAVIGATION_EVENTS) {
      this.api.on(event, (target?: unknown) => {
        const targetId = typeof target === 'string' && target !== '' ? target : undefined
        if (this.sequenced) {
          // With an engine, these only fire when it refused the request.
          runtimeEvents.emit('sequencing-error', {
            sessionId: this.sessionId,
            message: `The course requested "${request}${targetId ? ` ${targetId}` : ''}", but its sequencing rules do not allow it.`,
          })
          return
        }
        runtimeEvents.emit('navigation-request', {
          sessionId: this.sessionId,
          request,
          ...(targetId ? { target: targetId } : {}),
        })
      })
    }
  }

  /**
   * A request the engine refused or could not process. Refusals of the
   * LMS's own requests are the caller's to explain; a course's refused
   * request is reported with what it asked for and the IMS exception code.
   */
  private handleSequencingError(error: string, context?: string): void {
    if (this.lmsRequest) return
    const message =
      context === 'navigation' && this.lastRequest
        ? `The course requested "${this.lastRequest}", but its sequencing rules do not allow it (${error}).`
        : `Sequencing error: ${error}`
    runtimeEvents.emit('sequencing-error', { sessionId: this.sessionId, message })
  }

  private handleDelivery(activity: { id: string }): void {
    if (activity.id === this.deliveredThisRound) return
    this.deliveredThisRound = activity.id
    this.lastDelivered = activity as DeliveredActivity
    runtimeEvents.emit('activity-delivered', { sessionId: this.sessionId, activityId: activity.id })
  }

  private get process(): OverallSequencingProcess | null {
    return this.api.getSequencingService()?.getOverallSequencingProcess() ?? null
  }

  /**
   * Issue an LMS navigation request to the sequencing engine (start, choice,
   * continue, …). Returns whether the engine accepted it; a delivery, if
   * any, arrives as an `activity-delivered` event before this returns.
   */
  navigate(request: SequencingRequest, targetId?: string): boolean {
    if (!this.sequenced) return false
    this.deliveredThisRound = null
    this.lmsRequest = true
    try {
      return this.api.processNavigationRequest(request, targetId)
    } catch (error) {
      runtimeEvents.emit('sequencing-error', {
        sessionId: this.sessionId,
        message: `Navigation "${request}" failed: ${error instanceof Error ? error.message : String(error)}`,
      })
      return false
    } finally {
      this.lmsRequest = false
    }
  }

  /**
   * Bring the runtime back to "not initialized" for the next delivered SCO.
   * The sequencing state (activity tree, attempts, global objectives)
   * survives; the per-SCO CMI data starts clean.
   */
  prepareForDelivery(): void {
    this.api.reset()
    this.attachApiListeners()
    this.process?.updateNavigationValidity()
  }

  /** scorm-again's sequencing state as a string, for saving across reloads. */
  serializeSequencingState(): string | null {
    if (!this.sequenced) return null
    try {
      return this.api.serializeSequencingState()
    } catch {
      return null
    }
  }

  /** Restore state saved by `serializeSequencingState`; false when it does not apply. */
  restoreSequencingState(state: string): boolean {
    if (!this.sequenced) return false
    try {
      return this.api.deserializeSequencingState(state)
    } catch {
      return false
    }
  }

  navigationState(): NavigationState | null {
    const process = this.process
    if (!process) return null
    try {
      process.invalidateNavigationCache()
      return {
        canContinue: process.predictContinueEnabled(),
        canPrevious: process.predictPreviousEnabled(),
        choices: process.getAvailableChoices(),
        hiddenControls: process.getEffectiveHideLmsUi(this.lastDelivered),
      }
    } catch {
      // No current activity (e.g. after exitAll): nothing to navigate from.
      return null
    }
  }

  activityStatus(activityId: string): ActivityStatus | null {
    const data = this.api.getActivityTrackingData(activityId)
    if (!data) return null
    return {
      completionStatus: String(data.completionStatus),
      successStatus: String(data.successStatus),
      score: data.score,
    }
  }

  protected launchDataElements(data: ManifestItemLaunchData): Record<string, string | undefined> {
    return {
      // A new attempt; a restored suspended attempt overrides it with "resume".
      'cmi.entry': 'ab-initio',
      'cmi.launch_data': data.dataFromLms,
      'cmi.completion_threshold': data.completionThreshold,
      'cmi.scaled_passing_score': data.scaledPassingScore,
      'cmi.time_limit_action': data.timeLimitAction,
    }
  }

  protected learnerElements(learner: LearnerInfo): Record<string, string> {
    return { 'cmi.learner_id': learner.id, 'cmi.learner_name': learner.name }
  }

  /**
   * SCORM 2004: only a `suspend` exit keeps the attempt open —
   * the SCO resumes with its data and `cmi.entry` = `resume`. Any other
   * exit ends the attempt, so the next launch is a new attempt with fresh
   * data (`entry` = `ab-initio`).
   */
  protected resumeData(cmi: Record<string, unknown>): Record<string, unknown> | null {
    if (cmi['exit'] !== 'suspend') return null
    const next: Record<string, unknown> = { ...cmi, entry: 'resume' }
    delete next['exit']
    delete next['session_time']
    return next
  }

  initialize(): string {
    const result = this.runCall(
      'Initialize',
      () => {
        // A SCO may call Initialize again after Terminate in the same page;
        // reset the single-session scorm-again state machine so that works
        // instead of failing with error 101.
        this.resetApiIfNeeded(this.api)
        return this.api.Initialize('')
      },
      undefined,
      undefined,
      (r) => {
        // Runs on the real execution — immediately, or on resume if a
        // breakpoint parked the Initialize call.
        if (r === 'true') runtimeEvents.emit('initialized', { sessionId: this.sessionId })
      },
    )
    return result
  }

  terminate(): string {
    // A SCO-initiated navigation request is processed inside Terminate.
    this.deliveredThisRound = null
    const result = this.runCall('Terminate', () => this.api.Terminate(''), undefined, undefined, (r) => {
      if (r === 'true') runtimeEvents.emit('terminated', { sessionId: this.sessionId })
    })
    return result
  }

  getValue(element: string): string {
    return this.runCall('GetValue', () => this.api.GetValue(element), element)
  }

  setValue(element: string, value: string): string {
    return this.runCall('SetValue', () => this.api.SetValue(element, value), element, value)
  }

  commit(): string {
    return this.runCall('Commit', () => this.api.Commit(''))
  }

  getLastError(): string {
    return this.api.GetLastError()
  }

  getErrorString(errorCode: string): string {
    return this.api.GetErrorString(errorCode)
  }

  getDiagnostic(errorCode: string): string {
    return this.api.GetDiagnostic(errorCode)
  }

  getFlattenedCmi(): Record<string, string> {
    // scorm-again can emit non-string leaves (numbers, booleans, empty objects);
    // normalize so every consumer sees only strings. Its JSON export leaves out
    // the LMS-maintained cmi.total_time, which the SCO can read and a tester
    // needs to see, so it is added from the data model.
    return {
      ...normalizeFlattenedCmi(this.api.getFlattenedCMI()),
      'cmi.total_time': this.api.cmi.total_time,
    }
  }
}
