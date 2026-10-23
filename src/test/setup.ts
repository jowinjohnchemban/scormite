/**
 * Shared test setup (vitest).
 *
 * Loads jest-dom matchers + the `toHaveNoViolations` axe matcher, and
 * polyfills browser APIs that jsdom lacks but the app touches during render
 * (ResizeObserver, matchMedia, getComputedStyle quirks).
 */

import '@testing-library/jest-dom/vitest'
// vitest-axe 0.1.0's root `vitest-axe/matchers` entry re-exports types only
// (`export type *`), which breaks `verbatimModuleSyntax`; the runtime value
// lives at the deep dist path. The `expect(...).toHaveNoViolations()` type
// augmentation is provided by ./vitest-axe.d.ts (vitest-axe's own
// `extend-expect` targets the removed global `Vi` namespace).
import { toHaveNoViolations } from 'vitest-axe/dist/matchers'
import { expect, vi } from 'vitest'

expect.extend({ toHaveNoViolations })

// react-resizable-panels / DockLayout read the bare `localStorage` global.
// Node's experimental localStorage throws without --localstorage-file, so
// provide a working in-memory implementation on both window and globalThis.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  }
}
const memoryStorage = createMemoryStorage()
Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })

// react-resizable-panels / DockLayout observe panel sizes on mount.
class ResizeObserverMock {
  /** Kept like the real observer's; jsdom never reports a resize, so it is never called. */
  readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// Some components branch on prefers-reduced-motion / media queries.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// jsdom lacks scrollTo on elements used by some panels.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo
}

// axe-core requires a canvas-independent environment; jsdom is fine. But it
// also calls `window.getComputedStyle(...).getPropertyValue` — supported.
