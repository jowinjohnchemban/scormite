import { Scorm12API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import { ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

export class Scorm12Adapter extends ScormRuntimeAdapter {
  readonly api: Scorm12API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    // Disable HTTP commits — Scormite manages persistence itself.
    const apiSettings: Partial<Settings> = {
      lmsCommitUrl: false,
      autocommit: false,
      ...settings,
    }
    super(sessionId, apiSettings)
    this.api = new Scorm12API(apiSettings)
  }

  /**
   * scorm-again's `settings` setter merges into the live instance, so a
   * profile switch mid-session reaches every setting that is read at call
   * time (e.g. mastery/status derivation at Terminate).
   */
  protected applyApiSettings(settings: Partial<Settings>): void {
    this.api.settings = { ...this.api.settings, ...settings }
  }

  initialize(): string {
    const result = this.runCall(
      'Initialize',
      () => {
        // The adapter outlives the SCO iframe (mode switches remount it); reset
        // the single-session scorm-again state machine so a restarting course
        // can initialize again instead of failing with error 101.
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
