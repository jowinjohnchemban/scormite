import { Scorm2004API } from 'scorm-again'
import type { Settings } from 'scorm-again'
import type { ManifestItemLaunchData } from '@/shared/types'
import { LMS_BASE_SETTINGS, ScormRuntimeAdapter } from './ScormRuntimeAdapter'
import { normalizeFlattenedCmi } from './normalizeFlattenedCmi'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { NavigationRequest } from '../types'

/**
 * scorm-again raises one listener event per navigation request it parses out
 * of `adl.nav.request` at Terminate. The adapter forwards each as a typed
 * `navigation-request` runtime event; acting on it is the LMS's (the app's)
 * job.
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

export class Scorm2004Adapter extends ScormRuntimeAdapter {
  readonly scormVersion = '2004' as const
  readonly api: Scorm2004API

  constructor(sessionId: string, settings?: Partial<Settings>) {
    const apiSettings: Partial<Settings> = { ...LMS_BASE_SETTINGS, ...settings }
    super(sessionId, apiSettings)
    this.api = new Scorm2004API(apiSettings)
    for (const [event, request] of NAVIGATION_EVENTS) {
      this.api.on(event, (target?: unknown) => {
        runtimeEvents.emit('navigation-request', {
          sessionId: this.sessionId,
          request,
          ...(typeof target === 'string' && target !== '' ? { target } : {}),
        })
      })
    }
  }

  protected get lmsApi() {
    return this.api
  }

  protected launchDataElements(data: ManifestItemLaunchData): Record<string, string | undefined> {
    return {
      'cmi.launch_data': data.dataFromLms,
      'cmi.completion_threshold': data.completionThreshold,
      'cmi.scaled_passing_score': data.scaledPassingScore,
      'cmi.time_limit_action': data.timeLimitAction,
    }
  }

  /** `cmi.entry` is `resume` only after a suspended exit; exit/session_time start blank. */
  protected resumeData(cmi: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = {
      ...cmi,
      entry: cmi['exit'] === 'suspend' ? 'resume' : '',
    }
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
    // normalize so every consumer sees only strings.
    return normalizeFlattenedCmi(this.api.getFlattenedCMI())
  }
}
