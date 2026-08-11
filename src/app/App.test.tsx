import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'

// Shells have complex sub-trees (dock layout, panel registry) not under test
// here. Mock them to keep this suite a lightweight smoke test of the App
// shell — but the real PlayerFrame (the persistent player layer) IS rendered,
// because its continuity across mode switches is the behaviour under test.
let advancedShellProps: { onCenterRegionRectChange?: (rect: DOMRect | null) => void } = {}

vi.mock('@/app/modes/BasicModeShell', () => ({
  BasicModeShell: () => <div data-testid="basic-shell">Basic Mode</div>,
}))
vi.mock('@/app/modes/AdvancedModeShell', () => ({
  AdvancedModeShell: (props: { onCenterRegionRectChange?: (rect: DOMRect | null) => void }) => {
    advancedShellProps = props
    return <div data-testid="advanced-shell">Advanced Mode</div>
  },
}))

// App owns the single usePackageSession subscription; stub it so the player
// layer renders a live iframe regardless of the real runtime state.
vi.mock('@/app/hooks/usePackageSession', () => ({
  usePackageSession: () => ({
    pkg: {
      id: 'fixture',
      name: 'fixture-course',
      sourceType: 'zip',
      scormVersion: '1.2',
      manifest: { organizations: [], resources: [], metadata: {} },
      launchUrl: 'index.html',
      loadedAt: new Date(0),
    },
    loading: false,
    error: null,
    launchUrl: '/scorm-files/running-session/index.html',
    loadFile: vi.fn(),
    reload: vi.fn(),
    reset: vi.fn(),
  }),
}))

afterEach(cleanup)

describe('App shell', () => {
  beforeEach(() => {
    advancedShellProps = {}
  })

  it('defaults to Basic Mode', () => {
    render(<App />)
    expect(screen.getByTestId('basic-shell')).toBeInTheDocument()
  })

  it('switches to Advanced Mode on click', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByTestId('advanced-shell')).toBeInTheDocument()
  })

  it('keeps the same player iframe instance across a mode switch', async () => {
    // Regression test: the SCO iframe must never be unmounted, or the browser
    // destroys its browsing context and the running course reloads from scratch.
    render(<App />)
    const before = screen.getByTitle('SCORM Package')
    expect(before.tagName).toBe('IFRAME')

    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByTestId('advanced-shell')).toBeInTheDocument()
    expect(screen.getByTitle('SCORM Package')).toBe(before)

    await userEvent.click(screen.getByRole('button', { name: 'Basic' }))
    expect(screen.getByTitle('SCORM Package')).toBe(before)
  })

  it('sizes the advanced player iframe to the full center region height', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByTestId('advanced-shell')).toBeInTheDocument()

    const main = document.querySelector('main')
    if (!main) throw new Error('main element not found')

    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 600,
      bottom: 500,
      width: 500,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect)

    expect(advancedShellProps.onCenterRegionRectChange).toBeTypeOf('function')

    advancedShellProps.onCenterRegionRectChange?.({
      left: 120,
      top: 120,
      right: 620,
      bottom: 520,
      width: 500,
      height: 400,
      x: 120,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect)

    await waitFor(() => {
      const iframe = screen.getByTitle('SCORM Package') as HTMLIFrameElement
      expect(iframe.parentElement).not.toBeNull()
      expect(iframe.parentElement?.style.height).toBe('400px')
    })
  })
})
