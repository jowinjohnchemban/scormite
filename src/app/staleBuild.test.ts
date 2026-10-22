/**
 * Recognising a lazily loaded file that a newer deployment replaced, as each
 * browser reports it.
 */

import { describe, expect, it } from 'vitest'
import { isStaleBuildError } from './staleBuild'

describe('isStaleBuildError', () => {
  it.each([
    ['Chrome', 'Failed to fetch dynamically imported module: https://x.test/assets/A-1.js'],
    ['Firefox', 'error loading dynamically imported module: https://x.test/assets/A-1.js'],
    ['Safari', 'Importing a module script failed.'],
    ['Vite CSS preload', 'Unable to preload CSS for /assets/A-1.css'],
  ])('recognises %s', (_browser, message) => {
    expect(isStaleBuildError(new TypeError(message))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
  })
})
