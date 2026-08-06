import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { Scorm2004Adapter } from '../adapter/Scorm2004Adapter'
import { recordingMiddleware } from '../adapter/middleware/recordingMiddleware'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { ApiCallRecord } from '@/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScorm12(id = 'test-session-12'): {
  adapter: Scorm12Adapter
  records: ApiCallRecord[]
  unsub: () => void
} {
  const records: ApiCallRecord[] = []
  const adapter = new Scorm12Adapter(id)
  adapter.addMiddleware(recordingMiddleware)
  const unsub = runtimeEvents.on('api-call', (r) => records.push(r))
  return { adapter, records, unsub }
}

function makeScorm2004(id = 'test-session-2004'): {
  adapter: Scorm2004Adapter
  records: ApiCallRecord[]
  unsub: () => void
} {
  const records: ApiCallRecord[] = []
  const adapter = new Scorm2004Adapter(id)
  adapter.addMiddleware(recordingMiddleware)
  const unsub = runtimeEvents.on('api-call', (r) => records.push(r))
  return { adapter, records, unsub }
}

// ---------------------------------------------------------------------------
// SCORM 1.2 adapter tests
// ---------------------------------------------------------------------------

describe('Scorm12Adapter', () => {
  let ctx: ReturnType<typeof makeScorm12>

  beforeEach(() => { ctx = makeScorm12() })
  afterEach(() => { ctx.unsub() ; runtimeEvents.clear() })

  it('Initialize → SetValue → GetValue → Commit → Finish produces 5 records', () => {
    const { adapter, records } = ctx

    adapter.initialize()
    adapter.setValue('cmi.core.student_name', 'Alice')
    adapter.getValue('cmi.core.student_name')
    adapter.commit()
    adapter.terminate()

    expect(records).toHaveLength(5)
    expect(records.map((r) => r.method)).toEqual([
      'Initialize', 'SetValue', 'GetValue', 'Commit', 'Terminate',
    ])
  })

  it('Initialize returns "true"', () => {
    expect(ctx.adapter.initialize()).toBe('true')
  })

  it('SetValue records the element and value', () => {
    const { adapter, records } = ctx
    adapter.initialize()
    adapter.setValue('cmi.core.score.raw', '80')

    const setRecord = records.find((r) => r.method === 'SetValue')
    expect(setRecord?.element).toBe('cmi.core.score.raw')
    expect(setRecord?.value).toBe('80')
    expect(setRecord?.returnValue).toBe('true')
  })

  it('GetValue returns the previously set value', () => {
    const { adapter } = ctx
    adapter.initialize()
    adapter.setValue('cmi.core.score.raw', '90')
    expect(adapter.getValue('cmi.core.score.raw')).toBe('90')
  })

  it('each record has a sessionId, timestamp, and non-negative durationMs', () => {
    const { adapter, records } = ctx
    adapter.initialize()
    for (const r of records) {
      expect(r.sessionId).toBe('test-session-12')
      expect(r.timestamp).toBeGreaterThan(0)
      expect(r.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('getFlattenedCmi returns a non-empty object after initialize', () => {
    ctx.adapter.initialize()
    const cmi = ctx.adapter.getFlattenedCmi()
    expect(typeof cmi).toBe('object')
    expect(Object.keys(cmi).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// SCORM 2004 adapter tests
// ---------------------------------------------------------------------------

describe('Scorm2004Adapter', () => {
  let ctx: ReturnType<typeof makeScorm2004>

  beforeEach(() => { ctx = makeScorm2004() })
  afterEach(() => { ctx.unsub() ; runtimeEvents.clear() })

  it('Initialize → SetValue → GetValue → Commit → Terminate produces 5 records', () => {
    const { adapter, records } = ctx

    adapter.initialize()
    adapter.setValue('cmi.completion_status', 'completed')
    adapter.getValue('cmi.completion_status')
    adapter.commit()
    adapter.terminate()

    expect(records).toHaveLength(5)
    expect(records.map((r) => r.method)).toEqual([
      'Initialize', 'SetValue', 'GetValue', 'Commit', 'Terminate',
    ])
  })

  it('SetValue for score.raw records correctly', () => {
    const { adapter, records } = ctx
    adapter.initialize()
    adapter.setValue('cmi.score.raw', '85')

    const setRecord = records.find((r) => r.method === 'SetValue')
    expect(setRecord?.element).toBe('cmi.score.raw')
    expect(setRecord?.value).toBe('85')
  })
})

// ---------------------------------------------------------------------------
// Event bus tests
// ---------------------------------------------------------------------------

describe('runtimeEvents', () => {
  afterEach(() => runtimeEvents.clear())

  it('initialized event fires after SCORM 1.2 Initialize', () => {
    const fired: string[] = []
    runtimeEvents.on('initialized', ({ sessionId }) => fired.push(sessionId))

    const adapter = new Scorm12Adapter('sess-init')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()

    expect(fired).toContain('sess-init')
  })

  it('terminated event fires after SCORM 1.2 Finish', () => {
    const fired: string[] = []
    runtimeEvents.on('terminated', ({ sessionId }) => fired.push(sessionId))

    const adapter = new Scorm12Adapter('sess-term')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()
    adapter.terminate()

    expect(fired).toContain('sess-term')
  })

  it('unsubscribe stops receiving events', () => {
    const received: string[] = []
    const unsub = runtimeEvents.on('api-call', (r) => received.push(r.method))

    const adapter = new Scorm12Adapter('sess-unsub')
    adapter.addMiddleware(recordingMiddleware)
    adapter.initialize()
    unsub()
    adapter.terminate()

    // Only Initialize should be in the list — Terminate was after unsubscribe
    expect(received).toEqual(['Initialize'])
  })
})
