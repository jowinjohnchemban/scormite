import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { createBreakpointMiddleware } from '../adapter/middleware/breakpointMiddleware'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { Breakpoint, BreakpointHit } from '@/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePausable(): {
  adapter: Scorm12Adapter
  breakpoints: Breakpoint[]
  hits: BreakpointHit[]
} {
  const adapter = new Scorm12Adapter('pause-test')
  const breakpoints: Breakpoint[] = []
  const hits: BreakpointHit[] = []
  adapter.addMiddleware(
    createBreakpointMiddleware({
      getBreakpoints: () => breakpoints,
      onHit: (hit) => hits.push(hit),
    }),
  )
  return { adapter, breakpoints, hits }
}

// ---------------------------------------------------------------------------
// Pause gate — the Milestone 9 exit criteria
// ---------------------------------------------------------------------------

describe('breakpoint pause gate', () => {
  let ctx: ReturnType<typeof makePausable>

  beforeEach(() => {
    ctx = makePausable()
    ctx.adapter.initialize()
  })
  afterEach(() => runtimeEvents.clear())

  it('pauses a matching SetValue before the value is applied', () => {
    const { adapter, breakpoints, hits } = ctx
    breakpoints.push({
      id: 'bp1',
      kind: 'cmi-set',
      enabled: true,
      hitCount: 0,
      element: 'cmi.core.score.raw',
    })

    const result = adapter.setValue('cmi.core.score.raw', '80')

    // The call was parked, not applied: paused, one hit recorded, and the
    // element still holds its pre-pause value (reads pass through while
    // paused so the frozen state can be inspected).
    expect(adapter.isPaused).toBe(true)
    expect(adapter.pendingCallCount).toBe(1)
    expect(result).toBe('true')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.breakpointId).toBe('bp1')
    expect(adapter.getValue('cmi.core.score.raw')).not.toBe('80')

    adapter.resume()

    // After resume the parked call executes and the value is applied.
    expect(adapter.isPaused).toBe(false)
    expect(adapter.pendingCallCount).toBe(0)
    expect(adapter.getValue('cmi.core.score.raw')).toBe('80')
  })

  it('parks subsequent mutations in order and applies them on resume', () => {
    const { adapter, breakpoints } = ctx
    breakpoints.push({
      id: 'bp1',
      kind: 'cmi-set',
      enabled: true,
      hitCount: 0,
      element: 'cmi.core.score.raw',
    })

    adapter.setValue('cmi.core.score.raw', '60')
    adapter.setValue('cmi.core.lesson_location', 'page2')
    adapter.setValue('cmi.core.score.raw', '70')

    expect(adapter.pendingCallCount).toBe(3)
    // Reads still see the pre-pause state.
    expect(adapter.getValue('cmi.core.lesson_location')).not.toBe('page2')

    adapter.resume()

    expect(adapter.getValue('cmi.core.lesson_location')).toBe('page2')
    // Last write wins, exactly as the SCO issued them.
    expect(adapter.getValue('cmi.core.score.raw')).toBe('70')
  })

  it('does not pause calls that do not match any enabled breakpoint', () => {
    const { adapter, hits } = ctx
    adapter.setValue('cmi.core.lesson_location', 'intro')
    expect(adapter.isPaused).toBe(false)
    expect(hits).toHaveLength(0)
    expect(adapter.getValue('cmi.core.lesson_location')).toBe('intro')
  })

  it('a disabled breakpoint does not pause', () => {
    const { adapter, breakpoints } = ctx
    breakpoints.push({
      id: 'bp1',
      kind: 'cmi-set',
      enabled: false,
      hitCount: 0,
      element: 'cmi.core.score.raw',
    })
    adapter.setValue('cmi.core.score.raw', '88')
    expect(adapter.isPaused).toBe(false)
    expect(adapter.getValue('cmi.core.score.raw')).toBe('88')
  })

  it('an api-call breakpoint on GetValue pauses before the read', () => {
    const { adapter, breakpoints, hits } = ctx
    breakpoints.push({
      id: 'bp1',
      kind: 'api-call',
      enabled: true,
      hitCount: 0,
      method: 'GetValue',
      element: 'cmi.core.lesson_location',
    })
    adapter.setValue('cmi.core.lesson_location', 'intro')

    const result = adapter.getValue('cmi.core.lesson_location')

    expect(adapter.isPaused).toBe(true)
    expect(hits).toHaveLength(1)
    expect(result).toBe('false') // the read has not happened yet

    adapter.resume()
    // Breakpoints stay armed: the same read would pause again. Disable it so
    // the parked call's eventual result can be observed.
    breakpoints[0] = { ...breakpoints[0]!, enabled: false }
    expect(adapter.getValue('cmi.core.lesson_location')).toBe('intro')
  })

  it('resume is a no-op when not paused', () => {
    const { adapter } = ctx
    adapter.resume()
    expect(adapter.isPaused).toBe(false)
    expect(adapter.pendingCallCount).toBe(0)
  })

  it('notifies pause-state listeners', () => {
    const { adapter, breakpoints } = ctx
    const states: boolean[] = []
    adapter.onPauseChange((paused) => states.push(paused))
    breakpoints.push({
      id: 'bp1',
      kind: 'cmi-set',
      enabled: true,
      hitCount: 0,
      element: 'cmi.core.score.raw',
    })

    adapter.setValue('cmi.core.score.raw', '50')
    expect(states).toEqual([true])

    adapter.resume()
    expect(states).toEqual([true, false])
  })
})
