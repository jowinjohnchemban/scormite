import { Scorm2004API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import { ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

export class Scorm2004Adapter extends ScormRuntimeAdapter {
  readonly api: Scorm2004API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    super(sessionId)
    this.api = new Scorm2004API({
      lmsCommitUrl: false,
      autocommit: false,
      ...settings,
    })
  }

  initialize(): string {
    const result = this.runCall('Initialize', () => this.api.Initialize(''))
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
    return this.api.getFlattenedCMI() as Record<string, string>
  }
}
