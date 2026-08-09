import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiMonitorPanel } from './ApiMonitorPanel'
import { ConsolePanel } from './ConsolePanel'
import { useLogStore } from '@/features/logging'
import type { ApiCallRecord } from '@/shared/types'

const record: ApiCallRecord = {
  id: 'call-1',
  sessionId: 'session-1',
  timestamp: Date.UTC(2026, 0, 1, 12, 0, 0),
  method: 'SetValue',
  element: 'cmi.location',
  value: 'page-2',
  returnValue: 'true',
  durationMs: 2.34,
}

afterEach(cleanup)

beforeEach(() => {
  useLogStore.getState().clearRecords()
})

describe('ApiMonitorPanel', () => {
  it('renders newly recorded calls and clears them', async () => {
    useLogStore.getState().addRecord(record)
    render(<ApiMonitorPanel />)

    expect(screen.getByTestId('api-call-call-1')).toHaveTextContent('cmi.location')
    expect(screen.getByText('page-2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear API calls' }))
    expect(screen.getByText('API calls will appear when the course starts.')).toBeInTheDocument()
  })
})

describe('ConsolePanel', () => {
  it('formats runtime errors as console output', () => {
    useLogStore.getState().addRecord({ ...record, id: 'call-error', errorCode: '406' })
    render(<ConsolePanel />)

    expect(screen.getByText(/SetValue\("cmi.location", "page-2"\) → error 406/)).toBeInTheDocument()
  })
})
