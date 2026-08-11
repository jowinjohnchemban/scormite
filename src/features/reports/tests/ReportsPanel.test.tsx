import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReportsPanel } from '../components/ReportsPanel'
import type { ReportData } from '../services/ReportBuilderService'

afterEach(cleanup)

const sampleReport: ReportData = {
  generatedAt: '2025-01-01T00:00:00.000Z',
  package: {
    id: 'pkg-1',
    name: 'Sample Course',
    sourceType: 'zip',
    scormVersion: '1.2',
    launchUrl: 'index.html',
    loadedAt: '2025-01-01T00:00:00.000Z',
    resourceCount: 0,
    organizationCount: 0,
  },
  runtime: {
    sessionId: 'session-1',
    activeProfileId: 'strict-adl',
    scormVersion: '1.2',
    isInitialized: true,
    isTerminated: false,
    apiCallCount: 1,
    snapshotCount: 1,
    validationIssueCount: 1,
  },
  manifest: {
    organizations: [],
    resources: [],
    metadata: { title: 'Sample Course' },
  },
  apiCalls: [
    {
      id: 'call-1',
      sessionId: 'session-1',
      timestamp: 1700000000000,
      method: 'Initialize',
      returnValue: 'true',
      durationMs: 1.2,
    },
  ],
  snapshots: [
    {
      timestamp: 1700000000000,
      sessionId: 'session-1',
      data: { 'cmi.core.lesson_status': 'incomplete' },
      changedPaths: ['cmi.core.lesson_status'],
    },
  ],
  validationIssues: [
    {
      id: 'issue-1',
      severity: 'warning',
      source: 'runtime',
      message: 'Test warning',
      ruleId: 'runtime.test-warning',
    },
  ],
}

describe('ReportsPanel', () => {
  it('renders summary cards and export buttons when report data is provided', () => {
    render(<ReportsPanel reportData={sampleReport} ready={true} onExport={vi.fn()} />)

    expect(screen.getByText('Sample Course')).toBeInTheDocument()
    expect(screen.getByText('Export JSON')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(screen.getByText('Export Markdown')).toBeInTheDocument()
    expect(screen.getByText('Export HTML')).toBeInTheDocument()
  })

  it('shows an empty state when report data is not ready', () => {
    render(<ReportsPanel reportData={null} ready={false} onExport={vi.fn()} />)
    expect(screen.getByText('No package is loaded yet.')).toBeInTheDocument()
  })

  it('calls onExport when an export button is clicked', () => {
    const onExport = vi.fn()
    render(<ReportsPanel reportData={sampleReport} ready={true} onExport={onExport} />)

    const jsonButton = screen.getByTestId('export-json')
    fireEvent.click(jsonButton)
    expect(onExport).toHaveBeenCalledWith('json')
  })
})
