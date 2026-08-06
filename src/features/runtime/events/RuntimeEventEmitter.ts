import type { ApiCallRecord } from '@/shared/types'

type RuntimeEventMap = {
  /** Fired after every SCORM API call completes (post-recording-middleware). */
  'api-call': ApiCallRecord
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
