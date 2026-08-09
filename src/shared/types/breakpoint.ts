/**
 * Breakpoint entity types shared across features.
 *
 * Owned (constructed/mutated) by the session feature; the type lives here so
 * the runtime middleware (which pauses calls) and the session feature (which
 * stores breakpoints and renders the panel) can both reference it without
 * violating feature boundaries.
 *
 * Concrete first cut of the design doc's `Breakpoint { id, kind, condition,
 * enabled }` — the kind-specific `condition` predicate is represented by
 * discrete, serialisable match fields (method/element/value/threshold)
 * instead of arbitrary functions.
 */

import type { ScormApiMethod } from './session'

export type BreakpointKind = 'api-call' | 'cmi-set' | 'score-threshold' | 'objective-update'

export interface Breakpoint {
  id: string
  kind: BreakpointKind
  /** Disabled breakpoints are kept but never matched. */
  enabled: boolean
  /** Number of times this breakpoint has paused a call. */
  hitCount: number
  /** api-call: match only calls with this method. */
  method?: ScormApiMethod
  /** cmi-set / score-threshold / objective-update: element (path) to match. */
  element?: string
  /** cmi-set: match SetValue calls carrying exactly this value. */
  value?: string
  /** score-threshold: pause when score.raw is >= this number. */
  threshold?: number
}

/** Payload of the `breakpoint:hit` runtime event. */
export interface BreakpointHit {
  breakpointId: string
  sessionId: string
  method: ScormApiMethod
  element?: string
  value?: string
  timestamp: number
}
