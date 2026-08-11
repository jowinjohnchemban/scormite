import { describe, expect, it } from 'vitest'
import { getFieldLabel } from '@/shared/config/fieldConfig'

describe('fieldConfig', () => {
  it('returns a friendly label for known CMI fields', () => {
    expect(getFieldLabel('cmi.core.lesson_location')).toBe('Lesson Location')
    expect(getFieldLabel('cmi.score.raw')).toBe('Score (Raw)')
  })

  it('falls back to the raw field path for unknown fields', () => {
    expect(getFieldLabel('cmi.unknown.path')).toBe('cmi.unknown.path')
  })
})
