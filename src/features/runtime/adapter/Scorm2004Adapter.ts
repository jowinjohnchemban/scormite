import { Scorm2004API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import { ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

export class Scorm2004Adapter extends ScormRuntimeAdapter {
  readonly api: Scorm2004API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    // Disable HTTP commits — Scormite manages persistence itself.
    const apiSettings: Partial<Settings> = {
      lmsCommitUrl: false,
      autocommit: false,
      ...settings,
    }
    super(sessionId, apiSettings)
    this.api = new Scorm2004API(apiSettings)
  }

  initialize(): string {
    const result = this.runCall('Initialize', () => {
      // The adapter outlives the SCO iframe (mode switches remount it); reset
      // the single-session scorm-again state machine so a restarting course
      // can initialize again instead of failing with error 101.
      this.resetApiIfNeeded(this.api)
      return this.api.Initialize('')
    })
    if (result === 'true') runtimeEvents.emit('initialized', { sessionId: this.sessionId })
    return result
  }

  terminate(): string {
    const result = this.runCall('Terminate', () => this.api.Terminate(''))
    if (result === 'true') runtimeEvents.emit('terminated', { sessionId: this.sessionId })
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
    // normalize so every consumer sees only strings.
    return normalizeFlattenedCmi(this.api.getFlattenedCMI())
  }
}
