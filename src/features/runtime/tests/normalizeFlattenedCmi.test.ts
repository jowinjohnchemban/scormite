import { describe, it, expect } from 'vitest'
import { normalizeFlattenedCmi } from '../adapter/normalizeFlattenedCmi'

describe('normalizeFlattenedCmi', () => {
  it('passes strings through unchanged', () => {
    const result = normalizeFlattenedCmi({ 'cmi.core.lesson_status': 'completed' })
    expect(result).toEqual({ 'cmi.core.lesson_status': 'completed' })
  })

  it('stringifies numbers and booleans', () => {
    const result = normalizeFlattenedCmi({
      'cmi.core.score.raw': 85,
      'cmi.core.lesson_location': 42,
      'cmi.core.credit': true,
      'cmi.core.entry': false,
    })
    expect(result).toEqual({
      'cmi.core.score.raw': '85',
      'cmi.core.lesson_location': '42',
      'cmi.core.credit': 'true',
      'cmi.core.entry': 'false',
    })
  })

  it('turns null and undefined into empty strings', () => {
    const result = normalizeFlattenedCmi({
      'cmi.core.lesson_status': null,
      'cmi.core.score.raw': undefined,
    })
    expect(result).toEqual({
      'cmi.core.lesson_status': '',
      'cmi.core.score.raw': '',
    })
  })

  it('serializes empty objects and arrays so React never renders an object child', () => {
    // This is the exact failure mode from the Articulate Storyline crash:
    // flatten() emits {} for empty object leaves.
    const result = normalizeFlattenedCmi({
      'cmi.suspend_data.object': {},
      'cmi.suspend_data.array': [],
    })
    expect(result).toEqual({
      'cmi.suspend_data.object': '{}',
      'cmi.suspend_data.array': '[]',
    })
  })

  it('serializes nested objects and arrays as JSON', () => {
    const result = normalizeFlattenedCmi({
      'cmi.comments_from_lms.entry': { comment: 'hi', location: 'slide1' },
    })
    expect(result).toEqual({
      'cmi.comments_from_lms.entry': JSON.stringify({ comment: 'hi', location: 'slide1' }),
    })
  })

  it('returns an empty map for an empty input', () => {
    expect(normalizeFlattenedCmi({})).toEqual({})
  })

  it('every output value is a string', () => {
    const result = normalizeFlattenedCmi({
      a: 'x',
      b: 1,
      c: true,
      d: null,
      e: undefined,
      f: {},
      g: [1, 2],
    })
    for (const value of Object.values(result)) {
      expect(typeof value).toBe('string')
    }
  })
})
