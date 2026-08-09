import { Scorm12API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import { ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

export class Scorm12Adapter extends ScormRuntimeAdapter {
  readonly api: Scorm12API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    super(sessionId)
    this.api = new Scorm12API({
      // Disable HTTP commits — Scormite manages persistence itself.
      lmsCommitUrl: false,
      autocommit: false,
      ...settings,
    })
  }

  initialize(): string {
    const result = this.runCall('Initialize', () => this.api.LMSInitialize(''))
    if (result === 'true') runtimeEvents.emit('initialized', { sessionId: this.sessionId })
    return result
  }

  terminate(): string {
    const result = this.runCall('Terminate', () => this.api.LMSFinish(''))
    if (result === 'true') runtimeEvents.emit('terminated', { sessionId: this.sessionId })
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
