import { Scorm12API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import type { ManifestItemLaunchData } from '@/shared/types'
import { LMS_BASE_SETTINGS, ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

export class Scorm12Adapter extends ScormRuntimeAdapter {
  readonly scormVersion = '1.2' as const
  readonly api: Scorm12API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    const apiSettings: Partial<Settings> = { ...LMS_BASE_SETTINGS, ...settings }
    super(sessionId, apiSettings)
    this.api = new Scorm12API(apiSettings)
  }

  protected get lmsApi() {
    return this.api
  }

  /**
   * SCORM 1.2 manifest data lands in `cmi.launch_data` and
   * `cmi.student_data.*`. `cmi.core.credit` is always supplied by an LMS;
   * scorm-again's mastery_score → passed/failed derivation only runs for
   * credit attempts, so leaving it blank would hide real course behavior.
   */
  protected launchDataElements(data: ManifestItemLaunchData): Record<string, string | undefined> {
    return {
      'cmi.core.credit': 'credit',
      'cmi.launch_data': data.dataFromLms,
      'cmi.student_data.mastery_score': data.masteryScore,
      'cmi.student_data.max_time_allowed': data.maxTimeAllowed,
      'cmi.student_data.time_limit_action': data.timeLimitAction,
    }
  }

  /** `cmi.core.entry` is `resume` only after a suspended exit; exit/session_time start blank. */
  protected resumeData(cmi: Record<string, unknown>): Record<string, unknown> {
    const rawCore = cmi['core']
    const core: Record<string, unknown> =
      typeof rawCore === 'object' && rawCore !== null ? { ...rawCore } : {}
    core['entry'] = core['exit'] === 'suspend' ? 'resume' : ''
    delete core['exit']
    delete core['session_time']
    return { ...cmi, core }
  }

  initialize(): string {
    const result = this.runCall(
      'Initialize',
      () => {
        // A SCO may call LMSInitialize again after LMSFinish in the same
        // page; reset the single-session scorm-again state machine so that
        // works instead of failing with error 101.
        this.resetApiIfNeeded(this.api)
        return this.api.LMSInitialize('')
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
    const result = this.runCall('Terminate', () => this.api.LMSFinish(''), undefined, undefined, (r) => {
      if (r === 'true') runtimeEvents.emit('terminated', { sessionId: this.sessionId })
    })
    return result
  }

  getValue(element: string): string {
    return this.runCall('GetValue', () => this.api.LMSGetValue(element), element)
  }

  setValue(element: string, value: string): string {
    return this.runCall('SetValue', () => this.api.LMSSetValue(element, value), element, value)
  }

  commit(): string {
    return this.runCall('Commit', () => this.api.LMSCommit(''))
  }

  getLastError(): string {
    return this.api.LMSGetLastError()
  }

  getErrorString(errorCode: string): string {
    return this.api.LMSGetErrorString(errorCode)
  }

  getDiagnostic(errorCode: string): string {
    return this.api.LMSGetDiagnostic(errorCode)
  }

  getFlattenedCmi(): Record<string, string> {
    // scorm-again can emit non-string leaves (numbers, booleans, empty objects);
    // normalize so every consumer sees only strings.
    return normalizeFlattenedCmi(this.api.getFlattenedCMI())
  }
}
