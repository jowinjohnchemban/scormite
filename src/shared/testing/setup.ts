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
