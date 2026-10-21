import type { ApiCallRecord, BreakpointHit } from '@/shared/types'
import type { NavigationRequestEvent } from '../types'

type RuntimeEventMap = {
  /** Fired when a SCORM 2004 SCO terminates with a pending `adl.nav.request`. */
  'navigation-request': NavigationRequestEvent
  /** Fired after every SCORM API call completes (post-recording-middleware). */
  'api-call': ApiCallRecord
  /** Fired when a breakpoint pauses execution. */
  'breakpoint:hit': BreakpointHit
  /** Fired when Initialize succeeds. */
  initialized: { sessionId: string }
  /** Fired when Terminate/Finish succeeds. */
  terminated: { sessionId: string }
}

type Listener<T> = (data: T) => void

class RuntimeEventEmitter {
  private readonly _listeners = new Map<string, Set<Listener<unknown>>>()

  on<K extends keyof RuntimeEventMap>(
    event: K,
    listener: Listener<RuntimeEventMap[K]>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    const set = this._listeners.get(event)!
    set.add(listener as Listener<unknown>)
    return () => set.delete(listener as Listener<unknown>)
  }

  emit<K extends keyof RuntimeEventMap>(event: K, data: RuntimeEventMap[K]): void {
    this._listeners.get(event)?.forEach((l) => l(data))
  }

  /** Remove all listeners — call on session teardown. */
  clear(): void {
    this._listeners.clear()
  }
}

/** Singleton event bus for the runtime adapter layer. */
export const runtimeEvents = new RuntimeEventEmitter()
