import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CmiInspectorPanel } from './CmiInspectorPanel'
import { useInspectorStore } from '@/features/inspector'

afterEach(cleanup)

beforeEach(() => {
  useInspectorStore.getState().reset()
})

describe('CmiInspectorPanel', () => {
  it('renders the live CMI data as an indented tree', () => {
    useInspectorStore.getState().setBaseline({
      'cmi.location': 'intro',
      'cmi.score.raw': '20',
    })
    render(<CmiInspectorPanel />)

    expect(screen.getByText('2 CMI fields')).toBeInTheDocument()
    expect(screen.getByTestId('cmi-field-cmi.score.raw')).toHaveTextContent('20')
  })

  it('highlights fields changed by the most recent runtime update', () => {
    useInspectorStore.getState().setBaseline({ 'cmi.location': 'intro' })
    useInspectorStore.getState().updateValues({ 'cmi.location': 'next' })
    render(<CmiInspectorPanel />)

    expect(screen.getByTestId('cmi-field-cmi.location')).toHaveAttribute('data-changed', 'true')
  })
})
