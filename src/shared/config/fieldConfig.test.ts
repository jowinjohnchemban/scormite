/**
 * Unit tests for fieldDisplayConfig lookups — pure label/description/category mapping.
 */

import { describe, expect, it } from 'vitest'
import { getFieldCategory, getFieldDescription, getFieldLabel } from './fieldConfig'

describe('field config lookups', () => {
  it('maps known SCORM 1.2 paths to friendly labels', () => {
    expect(getFieldLabel('cmi.core.lesson_location')).toBe('Lesson Location')
    expect(getFieldLabel('cmi.core.lesson_status')).toBe('Lesson Status')
    expect(getFieldLabel('cmi.core.score.raw')).toBe('Score (Raw)')
    expect(getFieldLabel('cmi.core.total_time')).toBe('Total Time')
  })

  it('maps known SCORM 2004 paths to friendly labels', () => {
    expect(getFieldLabel('cmi.location')).toBe('Lesson Location')
    expect(getFieldLabel('cmi.completion_status')).toBe('Completion Status')
    expect(getFieldLabel('cmi.success_status')).toBe('Success Status')
    expect(getFieldLabel('cmi.score.raw')).toBe('Score (Raw)')
    expect(getFieldLabel('cmi.total_time')).toBe('Total Time')
  })

  it('falls back to the raw path for unknown fields', () => {
    expect(getFieldLabel('cmi.interactions.0.numeric_response')).toBe('cmi.interactions.0.numeric_response')
  })

  it('returns undefined descriptions for configured fields without one', () => {
    expect(getFieldDescription('cmi.core.lesson_status')).toBeUndefined()
  })

  it('returns undefined for unknown descriptions', () => {
    expect(getFieldDescription('totally.unknown')).toBeUndefined()
  })

  it('classifies known categories', () => {
    expect(getFieldCategory('cmi.core.lesson_status')).toBe('cmi')
    expect(getFieldCategory('cmi.location')).toBe('cmi')
  })

  it('classifies unknown fields as other', () => {
    expect(getFieldCategory('some.unknown.field')).toBe('other')
  })
})
