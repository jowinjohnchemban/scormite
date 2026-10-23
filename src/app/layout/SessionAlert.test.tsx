/**
 * The notice strip: dismissible, with an optional action button.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionAlert } from './SessionAlert'

describe('SessionAlert', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<SessionAlert message={null} onDismiss={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers its action and dismissal', () => {
    const onDismiss = vi.fn()
    const onClick = vi.fn()
    render(
      <SessionAlert
        message="Resumed the progress saved today."
        tone="info"
        onDismiss={onDismiss}
        action={{ label: 'Clear progress', onClick }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear progress' }))
    expect(onClick).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
