import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'

afterEach(cleanup)

describe('App shell', () => {
  it('defaults to Basic Mode and shows a DropZone', () => {
    render(<App />)

    expect(
      screen.getByRole('button', { name: /drop scorm zip here/i }),
    ).toBeInTheDocument()
  })

  it('switches to Advanced Mode on click', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))

    expect(
      screen.getByText(/Advanced Mode — load a package/i),
    ).toBeInTheDocument()
  })
})
