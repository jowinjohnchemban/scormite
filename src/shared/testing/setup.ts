import '@testing-library/jest-dom/vitest'

// jsdom doesn't wire up localStorage/sessionStorage by default in all versions.
// Provide a minimal in-memory implementation so components that persist layout
// state (e.g. DockLayout via react-resizable-panels) don't throw in tests.
function makeStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
}

Object.defineProperty(window, 'localStorage', { value: makeStorage(), writable: true })
Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), writable: true })

// jsdom has no layout engine, so it ships no ResizeObserver. react-resizable-panels
// observes every Group to recompute sizes; a no-op keeps it from throwing on mount.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub,
    writable: true,
  })
}
