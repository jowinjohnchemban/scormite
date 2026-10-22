/**
 * The error boundary contains a rendering failure, offers a retry, clears
 * itself when its reset key changes, and explains a file replaced by a newer
 * deployment as an update.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true
function Flaky() {
  if (shouldThrow) throw new Error('boom')
  return <p>recovered</p>
}

function StaleChunk(): never {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://example.test/assets/AdvancedModeShell-old.js',
  )
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows the failure with a retry that re-renders the children', async () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })

  it('explains a replaced file as an update and offers a reload instead of a retry', () => {
    render(
      <ErrorBoundary>
        <StaleChunk />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('SCORMite was updated while this page was open')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('clears the failure when the reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    shouldThrow = false
    rerender(
      <ErrorBoundary resetKey="b">
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})
