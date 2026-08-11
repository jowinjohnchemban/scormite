import type { RuntimeMiddleware, ApiCallResult } from '../../types'
import type { ApiCallRecord } from '@/shared/types'
import { runtimeEvents } from '../../events/RuntimeEventEmitter'

/**
 * Always-on middleware that converts every completed API call into an
 * ApiCallRecord and emits it on the runtime event bus.
 *
 * Downstream consumers (logStore, sessionStore) subscribe to 'api-call' on
 * runtimeEvents — they don't need to know about this middleware.
 */
export const recordingMiddleware: RuntimeMiddleware = {
  post(result: ApiCallResult): void {
    const record: ApiCallRecord = {
      id: crypto.randomUUID(),
      sessionId: result.sessionId,
      timestamp: result.timestamp,
      method: result.method,
      returnValue: result.returnValue,
      durationMs: result.durationMs,
      ...(result.element !== undefined ? { element: result.element } : {}),
      ...(result.value !== undefined ? { value: result.value } : {}),
      ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
    }
    runtimeEvents.emit('api-call', record)
  },
}
