import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BreakpointsPanel } from '../components/BreakpointsPanel'
import { useBreakpointStore } from '../state/breakpointStore'
import type { BreakpointHit } from '@/shared/types'

afterEach(cleanup)

beforeEach(() => {
  useBreakpointStore.getState().reset()
})

function hit(breakpointId: string): BreakpointHit {
  return {
    breakpointId,
    sessionId: 's1',
    method: 'SetValue',
    element: 'cmi.core.score.raw',
    value: '80',
    timestamp: 1,
  }
}

describe('BreakpointsPanel', () => {
  it('shows a hint when no breakpoints exist', () => {
    render(<BreakpointsPanel />)
    expect(screen.getByText(/Breakpoints pause the course/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add breakpoint/i })).toBeInTheDocument()
  })

  it('adds a cmi-set breakpoint from the form', () => {
    render(<BreakpointsPanel />)

    fireEvent.change(screen.getByLabelText('Element path to match'), {
      target: { value: 'cmi.core.score.raw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add breakpoint/i }))

    expect(screen.getByText('cmi.core.score.raw')).toBeInTheDocument()
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(1)
    expect(useBreakpointStore.getState().breakpoints[0]?.kind).toBe('cmi-set')
  })

  it('rejects a cmi-set breakpoint without an element', () => {
    render(<BreakpointsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /add breakpoint/i }))
    expect(screen.getByText(/An element path is required/i)).toBeInTheDocument()
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(0)
  })

  it('toggles and removes breakpoints', () => {
    const store = useBreakpointStore.getState()
    store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })
    store.addBreakpoint({ kind: 'api-call', method: 'Commit' })

    render(<BreakpointsPanel />)

    const checkboxes = screen.getAllByLabelText('Enable or disable breakpoint')
    expect(checkboxes).toHaveLength(2)
    fireEvent.click(checkboxes[0]!)
    expect(useBreakpointStore.getState().breakpoints[0]?.enabled).toBe(false)

    const removeButtons = screen.getAllByLabelText('Remove breakpoint')
    fireEvent.click(removeButtons[0]!)
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(1)
  })

  it('shows the pause banner with the hit details and resumes via the injected handler', () => {
    const store = useBreakpointStore.getState()
    const created = store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })
    let resumed = 0
    store.setResumeHandler(() => {
      resumed += 1
    })
    store.recordHit(hit(created.id))

    render(<BreakpointsPanel />)

    expect(screen.getByText(/Paused at SetValue cmi.core.score.raw/)).toBeInTheDocument()
    expect(screen.getByText('×1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(resumed).toBe(1)
  })

  it('clears all breakpoints from the header action', () => {
    const store = useBreakpointStore.getState()
    store.addBreakpoint({ kind: 'cmi-set', element: 'cmi.core.score.raw' })

    render(<BreakpointsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(useBreakpointStore.getState().breakpoints).toHaveLength(0)
  })

  it('adds an api-call breakpoint with a chosen method', () => {
    render(<BreakpointsPanel />)

    fireEvent.change(screen.getByLabelText('Breakpoint kind'), { target: { value: 'api-call' } })
    fireEvent.change(screen.getByLabelText('Method to match'), { target: { value: 'Commit' } })
    fireEvent.click(screen.getByRole('button', { name: /add breakpoint/i }))

    expect(useBreakpointStore.getState().breakpoints[0]?.kind).toBe('api-call')
    expect(useBreakpointStore.getState().breakpoints[0]?.method).toBe('Commit')
  })
})
