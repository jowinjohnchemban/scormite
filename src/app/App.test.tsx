import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'

// Shells have complex sub-trees (player, dock layout) not under test here.
// Mock them to keep this suite a lightweight smoke test of the App shell.
vi.mock('@/app/modes/BasicModeShell', () => ({
  BasicModeShell: () => <div data-testid="basic-shell">Basic Mode</div>,
}))
vi.mock('@/app/modes/AdvancedModeShell', () => ({
  AdvancedModeShell: () => <div data-testid="advanced-shell">Advanced Mode</div>,
}))

afterEach(cleanup)

describe('App shell', () => {
  it('defaults to Basic Mode', () => {
    render(<App />)
    expect(screen.getByTestId('basic-shell')).toBeInTheDocument()
  })

  it('switches to Advanced Mode on click', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByTestId('advanced-shell')).toBeInTheDocument()
  })
})
