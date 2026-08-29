import type { Breakpoint, BreakpointHit } from '@/shared/types'
import type { ApiCallContext, MiddlewareDecision, RuntimeMiddleware } from '../../types'
import { isScorePath } from '../cmiPaths'

/**
 * Dependencies the middleware needs, injected at creation time so it never
 * imports the session feature (boundary rule: features may not reach into
 * each other). The app layer wires this up in `usePackageSession`.
 */
export interface BreakpointMiddlewareOptions {
  /** Live breakpoints to match against — re-read on every call. */
  getBreakpoints: () => Breakpoint[]
  /** Fired when an enabled breakpoint pauses a call. */
  onHit: (hit: BreakpointHit) => void
}

/**
 * Pure matcher — exported so both the middleware and its tests exercise the
 * exact same predicate logic.
 */
export function matchesBreakpoint(breakpoint: Breakpoint, ctx: ApiCallContext): boolean {
  if (!breakpoint.enabled) return false
  switch (breakpoint.kind) {
    case 'api-call':
      return (
        (breakpoint.method === undefined || breakpoint.method === ctx.method) &&
        (breakpoint.element === undefined || ctx.element === breakpoint.element)
      )
    case 'cmi-set':
      return (
        ctx.method === 'SetValue' &&
        ctx.element === breakpoint.element &&
        (breakpoint.value === undefined || ctx.value === breakpoint.value)
      )
    case 'score-threshold':
      return (
        ctx.method === 'SetValue' &&
        isScorePath(ctx.element) &&
        (breakpoint.element === undefined || ctx.element === breakpoint.element) &&
        (breakpoint.threshold === undefined || Number(ctx.value) >= breakpoint.threshold)
      )
    case 'objective-update':
      return (
        ctx.method === 'SetValue' &&
        ctx.element !== undefined &&
        ctx.element.includes('objectives') &&
        (breakpoint.element === undefined || ctx.element === breakpoint.element)
      )
  }
}

/**
 * Pauses calls that match an enabled breakpoint.
 *
 * The `pre` hook only *signals* the pause — the adapter owns the gate. Once
 * paused, the adapter also parks every subsequent mutating call (execution is
 * globally suspended, not just the matched call), so the SCO cannot slip a
 * mutation in behind the breakpoint's back. Read-only calls still return real
 * values so the frozen state can be inspected.
 */
export function createBreakpointMiddleware(
  options: BreakpointMiddlewareOptions,
): RuntimeMiddleware {
  return {
    pre(ctx: ApiCallContext): MiddlewareDecision {
      const breakpoint = options
        .getBreakpoints()
        .find((candidate) => matchesBreakpoint(candidate, ctx))
      if (!breakpoint) return 'continue'
      options.onHit({
        breakpointId: breakpoint.id,
        sessionId: ctx.sessionId,
        method: ctx.method,
        ...(ctx.element !== undefined ? { element: ctx.element } : {}),
        ...(ctx.value !== undefined ? { value: ctx.value } : {}),
        timestamp: Date.now(),
      })
      return 'pause'
    },
  }
}
