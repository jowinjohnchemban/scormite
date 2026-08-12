/**
 * Unit tests for normalizeFlattenedCmi — leaf coercion at the adapter boundary.
 */

import { describe, expect, it } from 'vitest'
import { normalizeFlattenedCmi } from '../adapter/normalizeFlattenedCmi'

describe('normalizeFlattenedCmi', () => {
  it('returns an empty map for an empty input', () => {
    expect(normalizeFlattenedCmi({})).toEqual({})
  })

  it('passes string leaves through unchanged', () => {
    expect(normalizeFlattenedCmi({ 'cmi.core.lesson_status': 'completed' })).toEqual({
      'cmi.core.lesson_status': 'completed',
    })
  })

  it('coerces numbers and booleans to strings', () => {
    expect(
      normalizeFlattenedCmi({
        'cmi.core.score.raw': 100,
        'cmi.success_status': true,
      }),
    ).toEqual({
      'cmi.core.score.raw': '100',
      'cmi.success_status': 'true',
    })
  })

  it('coerces null and undefined leaves to empty strings', () => {
    expect(
      normalizeFlattenedCmi({
        'cmi.core.lesson_location': null,
        'cmi.core.entry': undefined,
      }),
    ).toEqual({
      'cmi.core.lesson_location': '',
      'cmi.core.entry': '',
    })
  })

  it('stringifies object leaves so React can render them', () => {
    expect(normalizeFlattenedCmi({ 'cmi.suspend_data': { a: 1 } })).toEqual({
      'cmi.suspend_data': '{"a":1}',
    })
  })

  it('preserves every key and does not mutate the input', () => {
    const input: Record<string, unknown> = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.core.score.raw': 42,
      'cmi.interactions.0.id': 'i1',
    }
    const result = normalizeFlattenedCmi(input)
    expect(Object.keys(result).sort()).toEqual(Object.keys(input).sort())
    expect(input['cmi.core.score.raw']).toBe(42)
  })
})
