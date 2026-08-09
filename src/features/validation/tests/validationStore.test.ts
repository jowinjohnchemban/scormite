import { describe, expect, it, beforeEach } from 'vitest'
import { useValidationStore } from '../state/validationStore'
import type { ValidationIssue } from '@/shared/types'

function issue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    id: crypto.randomUUID(),
    severity: 'error',
    source: 'manifest',
    message: 'Something is wrong',
    ruleId: 'manifest.missing-launch-file',
    ...overrides,
  }
}

beforeEach(() => {
  useValidationStore.getState().reset()
})

describe('validationStore', () => {
  it('addIssue appends and stamps lastRunAt', () => {
    useValidationStore.getState().addIssue(issue({ id: 'a' }))

    const state = useValidationStore.getState()
    expect(state.issues).toHaveLength(1)
    expect(state.issues[0]?.id).toBe('a')
    expect(state.lastRunAt).not.toBeNull()
  })

  it('addIssues appends a batch and stamps lastRunAt', () => {
    useValidationStore.getState().addIssues([issue({ id: 'a' }), issue({ id: 'b' })])

    expect(useValidationStore.getState().issues).toHaveLength(2)
    expect(useValidationStore.getState().lastRunAt).not.toBeNull()
  })

  it('removeIssue removes by id only', () => {
    useValidationStore.getState().addIssues([issue({ id: 'a' }), issue({ id: 'b' })])
    useValidationStore.getState().removeIssue('a')

    const remaining = useValidationStore.getState().issues
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('b')
  })

  it('clearIssues empties the list but keeps lastRunAt', () => {
    useValidationStore.getState().addIssues([issue({ id: 'a' })])
    const lastRunAt = useValidationStore.getState().lastRunAt

    useValidationStore.getState().clearIssues()

    const state = useValidationStore.getState()
    expect(state.issues).toHaveLength(0)
    expect(state.lastRunAt).toBe(lastRunAt)
  })

  it('reset clears issues and the run timestamp', () => {
    useValidationStore.getState().addIssues([issue({ id: 'a' })])
    useValidationStore.getState().reset()

    const state = useValidationStore.getState()
    expect(state.issues).toHaveLength(0)
    expect(state.lastRunAt).toBeNull()
  })
})
