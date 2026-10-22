/**
 * Breakpoints against the real runtime: which calls can be held, what the
 * SCO sees while execution is held, and the order held calls apply in.
 */

import { describe, expect, it } from 'vitest'
import type { Breakpoint, BreakpointHit } from '@/shared/types'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { createBreakpointMiddleware, matchesBreakpoint } from '../adapter/middleware/breakpointMiddleware'
import type { ApiCallContext } from '../types'

function breakpoint(overrides: Partial<Breakpoint>): Breakpoint {
  return { id: 'bp', kind: 'cmi-set', enabled: true, hitCount: 0, ...overrides }
}

function ctx(overrides: Partial<ApiCallContext>): ApiCallContext {
  return { sessionId: 's', method: 'SetValue', ...overrides }
}

describe('matchesBreakpoint', () => {
  it('matches SetValue on an element, optionally with an exact value', () => {
    const bp = breakpoint({ element: 'cmi.core.lesson_status', value: 'passed' })
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.core.lesson_status', value: 'passed' }))).toBe(true)
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.core.lesson_status', value: 'failed' }))).toBe(false)
  })

  it('matches scores at or above a threshold', () => {
    const bp = breakpoint({ kind: 'score-threshold', threshold: 80 })
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.core.score.raw', value: '80' }))).toBe(true)
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.core.score.raw', value: '79' }))).toBe(false)
  })

  it('matches objective changes', () => {
    const bp = breakpoint({ kind: 'objective-update' })
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.objectives.0.status', value: 'passed' }))).toBe(true)
    expect(matchesBreakpoint(bp, ctx({ element: 'cmi.core.lesson_location', value: 'p2' }))).toBe(false)
  })

  it('never holds Initialize, Terminate, or reads, whatever the breakpoint says', () => {
    const anyCall = breakpoint({ kind: 'api-call' })
    for (const method of ['Initialize', 'Terminate', 'GetValue', 'GetLastError'] as const) {
      expect(matchesBreakpoint(anyCall, ctx({ method }))).toBe(false)
    }
    expect(matchesBreakpoint(anyCall, ctx({ method: 'Commit' }))).toBe(true)
  })

  it('ignores disabled breakpoints', () => {
    expect(matchesBreakpoint(breakpoint({ enabled: false, element: 'cmi.suspend_data' }), ctx({ element: 'cmi.suspend_data' }))).toBe(false)
  })
})

describe('holding execution in the adapter', () => {
  function setup(breakpoints: Breakpoint[]) {
    const hits: BreakpointHit[] = []
    const adapter = new Scorm12Adapter('s')
    adapter.addMiddleware(createBreakpointMiddleware({ getBreakpoints: () => breakpoints, onHit: (hit) => hits.push(hit) }))
    adapter.initialize()
    return { adapter, hits }
  }

  it('holds a matching SetValue until resume; reads keep working meanwhile', () => {
    const { adapter, hits } = setup([breakpoint({ element: 'cmi.core.score.raw' })])
    expect(adapter.setValue('cmi.core.score.raw', '90')).toBe('true')
    expect(adapter.isPaused).toBe(true)
    expect(hits).toHaveLength(1)
    expect(adapter.getValue('cmi.core.score.raw')).toBe('')

    adapter.resume()
    expect(adapter.isPaused).toBe(false)
    expect(adapter.getValue('cmi.core.score.raw')).toBe('90')
  })

  it('discards held calls without applying them when their SCO is unloaded', () => {
    const { adapter } = setup([breakpoint({ element: 'cmi.core.score.raw' })])
    adapter.setValue('cmi.core.score.raw', '90')
    expect(adapter.discardHeldCalls()).toBe(1)
    expect(adapter.isPaused).toBe(false)
    expect(adapter.getValue('cmi.core.score.raw')).toBe('')
  })

  it('holds every later mutation too and applies them in order, Terminate included', () => {
    const { adapter } = setup([breakpoint({ element: 'cmi.core.lesson_location' })])
    adapter.setValue('cmi.core.lesson_location', 'p1')
    expect(adapter.setValue('cmi.core.lesson_location', 'p2')).toBe('true')
    expect(adapter.commit()).toBe('true')
    // The SCO is told Terminate succeeded; it really runs after the held calls.
    expect(adapter.terminate()).toBe('true')
    expect(adapter.pendingCallCount).toBe(4)

    adapter.resume()
    expect(adapter.pendingCallCount).toBe(0)
    expect(adapter.getFlattenedCmi()['cmi.core.lesson_location']).toBe('p2')
  })
})
