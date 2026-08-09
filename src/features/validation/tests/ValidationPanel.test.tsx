import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ValidationPanel } from '../components/ValidationPanel'
import { useValidationStore } from '../state/validationStore'
import type { ValidationIssue } from '@/shared/types'

afterEach(cleanup)

beforeEach(() => {
  useValidationStore.getState().reset()
})

function issue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    id: crypto.randomUUID(),
    severity: 'error',
    source: 'manifest',
    message: 'Launch file "missing.html" is not present in the package.',
    ruleId: 'manifest.missing-launch-file',
    ...overrides,
  }
}

describe('ValidationPanel', () => {
  it('shows the not-run-yet state before any validation pass', () => {
    render(<ValidationPanel />)
    expect(screen.getByText('Not run yet')).toBeTruthy()
    expect(screen.getByText(/Validation runs when a package loads/)).toBeTruthy()
  })

  it('shows a clean state once validated with no issues', () => {
    useValidationStore.getState().addIssues([])
    render(<ValidationPanel />)
    expect(screen.getByText('No issues')).toBeTruthy()
  })

  it('summarizes issues by severity in the header', () => {
    useValidationStore.getState().addIssues([
      issue({ severity: 'error' }),
      issue({ severity: 'error' }),
      issue({ severity: 'warning', ruleId: 'runtime.missing-commit' }),
    ])
    render(<ValidationPanel />)
    expect(screen.getByText('2 errors · 1 warning')).toBeTruthy()
  })

  it('renders each issue with its severity badge and details', () => {
    useValidationStore.getState().addIssues([
      issue({ severity: 'warning', source: 'runtime', ruleId: 'runtime.missing-commit', message: 'Course terminated without a successful Commit.' }),
    ])
    render(<ValidationPanel />)

    expect(screen.getByText('Warning')).toBeTruthy()
    expect(screen.getByText('Course terminated without a successful Commit.')).toBeTruthy()
    expect(screen.getByText(/runtime · runtime\.missing-commit/)).toBeTruthy()
  })

  it('dismisses an issue via its remove button', () => {
    const first = issue({ message: 'First problem' })
    useValidationStore.getState().addIssues([first, issue({ message: 'Second problem' })])
    render(<ValidationPanel />)

    const removeButtons = screen.getAllByLabelText('Dismiss issue')
    fireEvent.click(removeButtons[0]!)

    expect(screen.queryByText('First problem')).toBeNull()
    expect(screen.getByText('Second problem')).toBeTruthy()
  })

  it('clears all issues via the header button', () => {
    useValidationStore.getState().addIssues([issue(), issue()])
    render(<ValidationPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('list', { name: 'Validation issue list' })).toBeNull()
    expect(screen.getByText('No issues')).toBeTruthy()
  })

  it('does not offer Clear when there is nothing to clear', () => {
    useValidationStore.getState().addIssues([])
    render(<ValidationPanel />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })
})
