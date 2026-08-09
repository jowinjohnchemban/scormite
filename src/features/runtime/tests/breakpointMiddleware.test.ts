import { describe, expect, it } from 'vitest'
import { createBreakpointMiddleware, matchesBreakpoint } from '../adapter/middleware/breakpointMiddleware'
import type { Breakpoint } from '@/shared/types'
import type { ApiCallContext } from '../types'

function bp(overrides: Partial<Breakpoint> = {}): Breakpoint {
  return { id: 'bp', kind: 'cmi-set', enabled: true, hitCount: 0, ...overrides }
}

function ctx(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return { sessionId: 's', method: 'SetValue', ...overrides }
}

describe('matchesBreakpoint', () => {
  it('ignores disabled breakpoints', () => {
    expect(matchesBreakpoint(bp({ enabled: false, element: 'cmi.core.score.raw' }), ctx({ element: 'cmi.core.score.raw' }))).toBe(false)
  })

  it('cmi-set matches the element on a SetValue call', () => {
    expect(matchesBreakpoint(bp({ kind: 'cmi-set', element: 'cmi.core.score.raw' }), ctx({ element: 'cmi.core.score.raw' }))).toBe(true)
  })

  it('cmi-set does not match a different element or a GetValue', () => {
    expect(matchesBreakpoint(bp({ kind: 'cmi-set', element: 'cmi.core.score.raw' }), ctx({ element: 'cmi.core.lesson_location' }))).toBe(false)
    expect(matchesBreakpoint(bp({ kind: 'cmi-set', element: 'cmi.core.score.raw' }), ctx({ method: 'GetValue', element: 'cmi.core.score.raw' }))).toBe(false)
  })

  it('cmi-set optionally matches an exact value', () => {
    const target = bp({ kind: 'cmi-set', element: 'cmi.core.score.raw', value: '95' })
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.core.score.raw', value: '95' }))).toBe(true)
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.core.score.raw', value: '40' }))).toBe(false)
  })

  it('api-call matches by method alone or method + element', () => {
    const byMethod = bp({ kind: 'api-call', method: 'Commit' })
    expect(matchesBreakpoint(byMethod, ctx({ method: 'Commit' }))).toBe(true)
    expect(matchesBreakpoint(byMethod, ctx({ method: 'SetValue' }))).toBe(false)

    const byBoth = bp({ kind: 'api-call', method: 'GetValue', element: 'cmi.core.lesson_location' })
    expect(matchesBreakpoint(byBoth, ctx({ method: 'GetValue', element: 'cmi.core.lesson_location' }))).toBe(true)
    expect(matchesBreakpoint(byBoth, ctx({ method: 'GetValue', element: 'cmi.core.score.raw' }))).toBe(false)
  })

  it('score-threshold pauses when score.raw crosses the threshold', () => {
    const target = bp({ kind: 'score-threshold', threshold: 80 })
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.core.score.raw', value: '95' }))).toBe(true)
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.core.score.raw', value: '79' }))).toBe(false)
    // 2004 namespace also counts as a score path.
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.score.raw', value: '100' }))).toBe(true)
  })

  it('objective-update matches any SetValue touching the objectives tree', () => {
    const target = bp({ kind: 'objective-update' })
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.objectives.0.score.raw', value: '10' }))).toBe(true)
    expect(matchesBreakpoint(target, ctx({ element: 'cmi.core.lesson_status' }))).toBe(false)
  })
})

describe('createBreakpointMiddleware', () => {
  it('returns "pause" and reports the hit for a matching enabled breakpoint', () => {
    const hits: Array<{ breakpointId: string; element?: string; value?: string }> = []
    const breakpoints: Breakpoint[] = [
      bp({ id: 'bp1', kind: 'cmi-set', element: 'cmi.core.score.raw' }),
    ]
    const middleware = createBreakpointMiddleware({
      getBreakpoints: () => breakpoints,
      onHit: (hit) => hits.push(hit),
    })

    expect(middleware.pre?.(ctx({ element: 'cmi.core.score.raw', value: '80' }))).toBe('pause')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.breakpointId).toBe('bp1')
    expect(hits[0]?.element).toBe('cmi.core.score.raw')
    expect(hits[0]?.value).toBe('80')
  })

  it('returns "continue" when no breakpoint matches', () => {
    const middleware = createBreakpointMiddleware({
      getBreakpoints: () => [bp({ kind: 'cmi-set', element: 'cmi.core.lesson_location' })],
      onHit: () => undefined,
    })
    expect(middleware.pre?.(ctx({ element: 'cmi.core.score.raw' }))).toBe('continue')
  })

  it('re-reads the breakpoint list on every call (disabled mid-flight counts)', () => {
    const breakpoints: Breakpoint[] = [bp({ id: 'bp1', kind: 'cmi-set', element: 'cmi.core.score.raw' })]
    const middleware = createBreakpointMiddleware({
      getBreakpoints: () => breakpoints,
      onHit: () => undefined,
    })
    expect(middleware.pre?.(ctx({ element: 'cmi.core.score.raw' }))).toBe('pause')
    breakpoints[0] = { ...breakpoints[0]!, enabled: false }
    expect(middleware.pre?.(ctx({ element: 'cmi.core.score.raw' }))).toBe('continue')
  })
})
