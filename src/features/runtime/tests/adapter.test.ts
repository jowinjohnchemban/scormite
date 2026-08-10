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

  it('does not classify the SCORM success code 0 as an error', () => {
    ctx.adapter.initialize()
    expect(ctx.records[0]?.errorCode).toBeUndefined()
  })

  it('getFlattenedCmi returns a non-empty object after initialize', () => {
    ctx.adapter.initialize()
    const cmi = ctx.adapter.getFlattenedCmi()
    expect(typeof cmi).toBe('object')
    expect(Object.keys(cmi).length).toBeGreaterThan(0)
  })

  it('getFlattenedCmi values are all strings (normalized at the adapter boundary)', () => {
    ctx.adapter.initialize()
    ctx.adapter.setValue('cmi.core.score.raw', '80')
    const cmi = ctx.adapter.getFlattenedCmi()
    for (const value of Object.values(cmi)) {
      expect(typeof value).toBe('string')
    }
  })

  it('Initialize succeeds again after Terminate (iframe remount on mode switch)', () => {
    const { adapter } = ctx
    adapter.initialize()
    adapter.terminate()

    // Before the fix this returned "false" with error 101 (LMS is already finished).
    expect(adapter.initialize()).toBe('true')
    expect(adapter.terminate()).toBe('true')
  })

  it('suspend_data survives a re-initialize after Terminate (course can resume)', () => {
    const { adapter } = ctx
    adapter.initialize()
    adapter.setValue('cmi.suspend_data', '{"page":3}')
    adapter.terminate()

    // scorm-again reset() keeps suspend_data + lesson_status for SCORM 1.2,
    // so a restarted course (iframe remount) can restore its state.
    adapter.initialize()
    expect(adapter.getValue('cmi.suspend_data')).toBe('{"page":3}')
  })

  it('re-initialize after Terminate does not record an error code', () => {
    const { adapter, records } = ctx
    adapter.initialize()
    adapter.terminate()
    adapter.initialize()

    const secondInit = records.find((r) => r.method === 'Initialize' && r.returnValue === 'true')
    expect(secondInit?.errorCode).toBeUndefined()
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

  it('Initialize succeeds again after Terminate (iframe remount on mode switch)', () => {
    const { adapter } = ctx
    adapter.initialize()
    adapter.terminate()

    // Before the fix this returned "false" with error 101 (LMS is already finished).
    expect(adapter.initialize()).toBe('true')
    expect(adapter.terminate()).toBe('true')
  })

  it('re-initialize after Terminate starts a fresh attempt (2004 semantics)', () => {
    const { adapter } = ctx
    adapter.initialize()
    adapter.setValue('cmi.completion_status', 'completed')
    adapter.terminate()

    // SCORM 2004 reset() clears SCO-specific data: entry becomes "ab-initio"
    // and completion_status returns to "unknown".
    adapter.initialize()
    expect(adapter.getValue('cmi.completion_status')).toBe('unknown')
    expect(adapter.getValue('cmi.entry')).toBe('ab-initio')
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

// ---------------------------------------------------------------------------
// Runtime profile application — the Milestone 11 exit criteria (adapter half)
// ---------------------------------------------------------------------------

describe('configure (runtime profile overrides)', () => {
  afterEach(() => runtimeEvents.clear())

  it('applies whitelisted knobs to the live scorm-again settings (1.2)', () => {
    const adapter = new Scorm12Adapter('configure-12')

    adapter.configure({
      mastery_override: false,
      score_overrides_status: true,
      autoCompleteLessonStatus: true,
    })

    expect(adapter.api.settings.mastery_override).toBe(false)
    expect(adapter.api.settings.score_overrides_status).toBe(true)
    expect(adapter.api.settings.autoCompleteLessonStatus).toBe(true)
  })

  it('applies whitelisted knobs to the live scorm-again settings (2004)', () => {
    const adapter = new Scorm2004Adapter('configure-2004')

    adapter.configure({
      mastery_override: true,
      score_overrides_status: false,
      autoCompleteLessonStatus: true,
    })

    expect(adapter.api.settings.mastery_override).toBe(true)
    expect(adapter.api.settings.score_overrides_status).toBe(false)
    expect(adapter.api.settings.autoCompleteLessonStatus).toBe(true)
  })

  it('applies explicit false values (a value of false is not undefined)', () => {
    const adapter = new Scorm12Adapter('configure-false')
    adapter.configure({ score_overrides_status: false })

    expect(adapter.api.settings.score_overrides_status).toBe(false)
  })

  it('ignores unknown keys instead of throwing or applying them', () => {
    const adapter = new Scorm12Adapter('configure-unknown')
    const before = { ...adapter.api.settings }

    // strict_errors is NOT whitelisted — passing it must leave it untouched,
    // and an outright unknown key must never reach the settings object.
    adapter.configure({ strict_errors: !before.strict_errors, not_a_real_setting: 42 })

    expect(adapter.api.settings.strict_errors).toBe(before.strict_errors)
    expect(adapter.api.settings).not.toHaveProperty('not_a_real_setting')
    // No whitelisted knob was touched.
    expect(adapter.api.settings.mastery_override).toBeDefined()
  })

  it('is a no-op for empty overrides', () => {
    const adapter = new Scorm12Adapter('configure-empty')
    const before = { ...adapter.api.settings }

    adapter.configure({})

    expect(adapter.api.settings.mastery_override).toBe(before.mastery_override)
  })

  it('merges over a previous configure call instead of replacing it', () => {
    const adapter = new Scorm12Adapter('configure-merge')

    adapter.configure({ mastery_override: false })
    adapter.configure({ autoCompleteLessonStatus: true })

    expect(adapter.api.settings.mastery_override).toBe(false)
    expect(adapter.api.settings.autoCompleteLessonStatus).toBe(true)
  })

  it('keeps the profile across a terminate → re-initialize cycle (reset keeps overrides)', () => {
    const adapter = new Scorm12Adapter('configure-reset')
    adapter.configure({ mastery_override: false })

    adapter.initialize()
    adapter.terminate()
    adapter.initialize()

    // resetApiIfNeeded passes apiSettings (which includes the profile) to
    // scorm-again's reset(), so a remounted SCO runs under the same profile.
    expect(adapter.api.settings.mastery_override).toBe(false)
  })
})
