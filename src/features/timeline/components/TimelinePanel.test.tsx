import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TimelinePanel } from './TimelinePanel'
import { useTimelineStore } from '@/features/timeline'

afterEach(cleanup)

beforeEach(() => {
  useTimelineStore.getState().reset()
})

function seedSnapshots(): void {
  const store = useTimelineStore.getState()
  store.captureSnapshot({
    timestamp: new Date('2026-01-01T10:00:00.000').getTime(),
    sessionId: 's1',
    data: { 'cmi.location': 'intro', 'cmi.core.lesson_status': 'incomplete' },
  })
  store.captureSnapshot({
    timestamp: new Date('2026-01-01T10:00:02.500').getTime(),
    sessionId: 's1',
    data: { 'cmi.location': 'page2', 'cmi.core.lesson_status': 'completed' },
  })
}

describe('TimelinePanel', () => {
  it('shows a hint when no snapshots have been captured', () => {
    render(<TimelinePanel />)
    expect(screen.getByText(/CMI state changes will appear here/i)).toBeInTheDocument()
  })

  it('renders each snapshot as a clickable point', () => {
    seedSnapshots()
    render(<TimelinePanel />)

    const points = screen.getAllByRole('button')
    // #1 and #2 rows + Resume live button.
    expect(points).toHaveLength(3)
    expect(screen.getByRole('button', { name: /#1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#2/ })).toBeInTheDocument()
  })

  it('shows the latest snapshot as live until the user scrubs', () => {
    seedSnapshots()
    render(<TimelinePanel />)

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume live' })).toBeDisabled()
    expect(screen.getByLabelText('Timeline position')).toHaveValue('1')
  })

  it('scrubbing via the slider pins the snapshot header', () => {
    seedSnapshots()
    render(<TimelinePanel />)

    fireEvent.change(screen.getByLabelText('Timeline position'), { target: { value: '0' } })

    expect(screen.getByText('Snapshot 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume live' })).toBeEnabled()
  })

  it('clicking a snapshot row scrubs to that point and highlights it', () => {
    seedSnapshots()
    render(<TimelinePanel />)

    fireEvent.click(screen.getByRole('button', { name: /#1/ }))

    expect(screen.getByText('Snapshot 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#1/ })).toHaveAttribute('data-selected', 'true')
  })

  it('Resume live returns the panel to live mode', () => {
    seedSnapshots()
    render(<TimelinePanel />)

    fireEvent.click(screen.getByRole('button', { name: /#1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume live' }))

    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume live' })).toBeDisabled()
  })
})
