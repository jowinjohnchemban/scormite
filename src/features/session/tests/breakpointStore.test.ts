import { describe, expect, it, beforeEach } from 'vitest'
import { useBreakpointStore } from '../state/breakpointStore'
import type { BreakpointHit } from '@/shared/types'

function hit(breakpointId: string): BreakpointHit {
  return {
    breakpointId,
    sessionId: 's1',
    method: 'SetValue',
    element: 'cmi.core.score.raw',
    value: '80',
    timestamp: 1,
  }
}

beforeEach(() => {
  useBreakpointStore.getState().reset()
})

describe('breakpointStore', () => {
  it('addBreakpoint generates id/state defaults', () => {
    const created = useBreakpointStore.getState().addBreakpoint({
      kind: 'cmi-set',
      element: 'cmi.core.score.raw',
    })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.enabled).toBe(true)
    expect(created.hitCount).toBe(0)
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(1)
  })

  it('remove / toggle / clear manage the list', () => {
    const store = useBreakpointStore.getState()
    const a = store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })
    const b = store.addBreakpoint({ kind: 'api-call', method: 'Commit' })

    useBreakpointStore.getState().toggleBreakpoint(a.id)
    expect(useBreakpointStore.getState().breakpoints.find((bp) => bp.id === a.id)?.enabled).toBe(false)

    useBreakpointStore.getState().removeBreakpoint(b.id)
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(1)

    useBreakpointStore.getState().clearBreakpoints()
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(0)
  })

  it('recordHit pauses, remembers the hit, and bumps the hit count', () => {
    const store = useBreakpointStore.getState()
    const created = store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })

    useBreakpointStore.getState().recordHit(hit(created.id))

    const state = useBreakpointStore.getState()
    expect(state.paused).toBe(true)
    expect(state.currentHit?.breakpointId).toBe(created.id)
    expect(state.breakpoints[0]?.hitCount).toBe(1)

    useBreakpointStore.getState().recordHit(hit(created.id))
    expect(useBreakpointStore.getState().breakpoints[0]?.hitCount).toBe(2)
  })

  it('setPausedFlag(false) clears the current hit; setPausedFlag(true) does not', () => {
    const store = useBreakpointStore.getState()
    const created = store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })

    useBreakpointStore.getState().recordHit(hit(created.id))
    useBreakpointStore.getState().setPausedFlag(true)
    expect(useBreakpointStore.getState().currentHit?.breakpointId).toBe(created.id)

    useBreakpointStore.getState().setPausedFlag(false)
    expect(useBreakpointStore.getState().paused).toBe(false)
    expect(useBreakpointStore.getState().currentHit).toBeNull()
  })

  it('resume invokes the injected resume handler', () => {
    let resumed = 0
    useBreakpointStore.getState().setResumeHandler(() => {
      resumed += 1
    })

    useBreakpointStore.getState().resume()
    expect(resumed).toBe(1)

    useBreakpointStore.getState().setResumeHandler(null)
    useBreakpointStore.getState().resume()
    expect(resumed).toBe(1)
  })

  it('reset clears breakpoints, pause state, and the handler', () => {
    const store = useBreakpointStore.getState()
    const created = store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })
    useBreakpointStore.getState().recordHit(hit(created.id))
    useBreakpointStore.getState().setResumeHandler(() => undefined)

    useBreakpointStore.getState().reset()

    const state = useBreakpointStore.getState()
    expect(state.breakpoints).toHaveLength(0)
    expect(state.paused).toBe(false)
    expect(state.currentHit).toBeNull()
    expect(state.resumeHandler).toBeNull()
  })
})
