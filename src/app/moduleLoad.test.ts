/**
 * Recognising a lazily loaded part of the app that could not be fetched, as
 * each browser reports it. The retry through a fresh URL is covered end to end
 * (e2e/mode-switch.spec.ts).
 */

import { describe, expect, it, vi } from 'vitest'
import { importWithRetry, isModuleLoadError } from './moduleLoad'

describe('isModuleLoadError', () => {
  it.each([
    ['Chrome', 'Failed to fetch dynamically imported module: https://x.test/assets/A-1.js'],
    ['Firefox', 'error loading dynamically imported module: https://x.test/assets/A-1.js'],
    ['Safari', 'Importing a module script failed.'],
    ['Vite CSS preload', 'Unable to preload CSS for /assets/A-1.css'],
  ])('recognises %s', (_browser, message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isModuleLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isModuleLoadError(null)).toBe(false)
  })
})

describe('importWithRetry', () => {
  it('returns the module when the first import succeeds', async () => {
    const load = vi.fn(async () => ({ value: 1 }))
    await expect(importWithRetry(load)).resolves.toEqual({ value: 1 })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('rethrows other errors without retrying', async () => {
    const failure = new Error('Cannot read properties of undefined')
    await expect(importWithRetry(() => Promise.reject(failure))).rejects.toBe(failure)
  })

  it('reports the original failure when the retry through a fresh URL fails too', async () => {
    const failure = new TypeError('Failed to fetch dynamically imported module: https://x.test/assets/Gone-1.js')
    await expect(importWithRetry(() => Promise.reject(failure))).rejects.toBe(failure)
  })
})
