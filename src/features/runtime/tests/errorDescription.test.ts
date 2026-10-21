/**
 * Failed calls carry scorm-again's own explanation (GetErrorString /
 * GetDiagnostic) into the recorded ApiCallRecord, without disturbing the
 * error state the SCO reads back.
 */

import { afterEach, describe, expect, it } from 'vitest'
import type { ApiCallRecord } from '@/shared/types'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { recordingMiddleware } from '../adapter/middleware/recordingMiddleware'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

const unsubscribers: (() => void)[] = []
afterEach(() => {
  for (const off of unsubscribers.splice(0)) off()
})

describe('error description on recorded calls', () => {
  it('records errorString and a distinct diagnostic for a failed SetValue', () => {
    const records: ApiCallRecord[] = []
    unsubscribers.push(runtimeEvents.on('api-call', (r) => records.push(r)))
    const adapter = new Scorm12Adapter('s1')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()

    expect(adapter.setValue('cmi.core.not_an_element', '1')).toBe('false')
    const failed = records.at(-1)
    expect(failed?.errorCode).toBe('401')
    expect(failed?.errorString).toBe('Not implemented error')
    expect(failed?.diagnostic).toContain('cmi.core.not_an_element')

    // The SCO still sees the same error after the adapter described it.
    expect(adapter.getLastError()).toBe('401')
  })

  it('omits the diagnostic when it only repeats the error string', () => {
    const records: ApiCallRecord[] = []
    unsubscribers.push(runtimeEvents.on('api-call', (r) => records.push(r)))
    const adapter = new Scorm12Adapter('s1')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()

    adapter.setValue('cmi.core.score.raw', 'abc')
    expect(records.at(-1)?.errorString).toBe('Incorrect Data Type')
    expect(records.at(-1)?.diagnostic).toBeUndefined()
  })

  it('leaves successful calls without error fields', () => {
    const records: ApiCallRecord[] = []
    unsubscribers.push(runtimeEvents.on('api-call', (r) => records.push(r)))
    const adapter = new Scorm12Adapter('s1')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()
    expect(records.at(-1)).not.toHaveProperty('errorCode')
    expect(records.at(-1)).not.toHaveProperty('errorString')
  })
})
