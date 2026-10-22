/**
 * SCORMite's WebMCP tools against seeded app state: what they return, the
 * actionable errors when a precondition fails, and their annotations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { useCourseStore } from '@/app/state/courseStore'
import { useLogStore } from '@/features/logging'
import { useRuntimeStore } from '@/features/runtime'
import { useValidationStore } from '@/features/validation'
import type { LaunchableItem } from '@/shared/types'
import { createScormiteTools, type ToolHost } from './tools'

const item = (identifier: string, title: string): LaunchableItem =>
  ({ identifier, title, scormType: 'sco', depth: 0, launchPath: `${identifier}.html` }) as LaunchableItem

function fakeSession(open: boolean): PackageSession {
  return {
    pkg: open
      ? ({ id: 'p', name: 'Course', scormVersion: '2004', scormEdition: '4th' } as PackageSession['pkg'])
      : null,
    loading: false,
    loadingName: null,
    error: null,
    launchUrl: null,
    launchKey: 0,
    currentItem: open ? item('a', 'Intro') : null,
    loadFile: vi.fn(),
    relaunch: vi.fn(),
    newAttempt: vi.fn(),
    restartCourse: vi.fn(),
    close: vi.fn(),
    dismissError: vi.fn(),
  }
}

let session: PackageSession
let mode: 'basic' | 'advanced'
let advanced: boolean
const host: ToolHost = {
  session: () => session,
  mode: () => mode,
  setMode: (next) => {
    mode = next
  },
  advancedAvailable: () => advanced,
}
const tools = createScormiteTools(host)
const tool = (name: string) => {
  const found = tools.find((t) => t.name === name)
  if (!found) throw new Error(`no tool ${name}`)
  return found
}
const run = (name: string, input: Record<string, unknown> = {}) =>
  tool(name).execute(input, { signal: new AbortController().signal }) as Promise<Record<string, unknown>>

beforeEach(() => {
  session = fakeSession(true)
  mode = 'basic'
  advanced = true
  useCourseStore.setState({
    items: [item('a', 'Intro'), item('b', 'Quiz')],
    sequenced: true,
    currentItemId: 'a',
    progress: {
      a: { completionStatus: 'completed', successStatus: 'passed', score: '90', location: '', time: '' },
    },
    navigation: { canContinue: true, canPrevious: false, choices: ['a'], hiddenControls: [] },
    pendingLaunch: null,
    pendingNavigation: null,
    endedReason: null,
  })
  useRuntimeStore.setState({
    adapter: { getFlattenedCmi: () => ({ 'cmi.completion_status': 'completed', 'cmi.location': 'p3' }) } as never,
    scormVersion: '2004',
    isInitialized: true,
    isTerminated: false,
  })
  useLogStore.setState({
    records: [
      { id: '1', sessionId: 's', timestamp: 0, method: 'Initialize', returnValue: 'true', durationMs: 0 },
      {
        id: '2',
        sessionId: 's',
        timestamp: 1,
        method: 'SetValue',
        element: 'cmi.score.raw',
        value: 'x',
        returnValue: 'false',
        durationMs: 0,
        errorCode: '406',
        errorString: 'Data Model Element Type Mismatch',
      },
    ],
  })
  useValidationStore.setState({
    issues: [
      { id: 'v', severity: 'warning', source: 'runtime', message: 'No commit', ruleId: 'runtime.missing-commit' },
    ],
  })
})

afterEach(() => {
  useCourseStore.getState().reset()
  useRuntimeStore.getState().reset()
  useLogStore.getState().clearRecords()
  useValidationStore.getState().reset()
})

describe('WebMCP tools', () => {
  it('flags every tool that returns package content as untrusted, and only discarding data as consequential', () => {
    const untrusted = tools.filter((t) => t.annotations?.untrustedContentHint).map((t) => t.name)
    expect(untrusted).toEqual(['get_session', 'get_cmi', 'get_api_log', 'get_validation_issues', 'get_report'])
    expect(tools.filter((t) => t.annotations?.consequentialHint).map((t) => t.name)).toEqual(['discard_and_restart'])
    for (const name of untrusted) expect(tool(name).annotations?.readOnlyHint).toBe(true)
  })

  it('describes the session as the outline shows it', async () => {
    const result = await run('get_session')
    expect(result).toMatchObject({
      open: true,
      package: { name: 'Course', scormVersion: '2004', scormEdition: '4th' },
      currentItemId: 'a',
      navigation: { canPrevious: false, canNext: true },
    })
    expect(result['items']).toEqual([
      expect.objectContaining({ id: 'a', current: true, allowed: true, successStatus: 'passed', score: '90' }),
      expect.objectContaining({ id: 'b', current: false, allowed: false, completionStatus: 'not attempted' }),
    ])
  })

  it('answers every tool with what to do when no package is open', async () => {
    session = fakeSession(false)
    expect(await run('get_session')).toMatchObject({ open: false })
    for (const name of ['get_cmi', 'get_api_log', 'get_validation_issues', 'launch_item', 'navigate']) {
      expect((await run(name, { itemId: 'a', direction: 'next' }))['error']).toMatch(/No package is open/)
    }
  })

  it('reads the CMI, filtered by prefix', async () => {
    expect(await run('get_cmi', { prefix: 'cmi.loc' })).toEqual({
      scormVersion: '2004',
      elements: { 'cmi.location': 'p3' },
    })
  })

  it('reads the API log, newest last, with error explanations', async () => {
    const result = await run('get_api_log', { failedOnly: true })
    expect(result['total']).toBe(2)
    expect(result['calls']).toEqual([
      expect.objectContaining({
        method: 'SetValue',
        element: 'cmi.score.raw',
        errorCode: '406',
        error: 'Data Model Element Type Mismatch',
      }),
    ])
  })

  it('lists validation issues', async () => {
    expect(await run('get_validation_issues')).toEqual({
      issues: [{ severity: 'warning', rule: 'runtime.missing-commit', source: 'runtime', message: 'No commit' }],
    })
  })

  it('launches an allowed item, and refuses unknown or forbidden ones', async () => {
    const go = vi.spyOn(useCourseStore.getState(), 'go')
    expect((await run('launch_item', { itemId: 'zzz' }))['error']).toMatch(/Unknown item/)
    expect((await run('launch_item', { itemId: 'b' }))['error']).toMatch(/sequencing rules do not allow/)
    expect(go).not.toHaveBeenCalled()
    expect(await run('launch_item', { itemId: 'a' })).toMatchObject({ requested: true })
    expect(go).toHaveBeenCalledWith({ request: 'choice', targetId: 'a', mode: 'resume' })
  })

  it('navigates only in allowed directions, and waits while a launch is pending', async () => {
    expect((await run('navigate', { direction: 'previous' }))['error']).toMatch(/Previous is not allowed/)
    expect(await run('navigate', { direction: 'next' })).toMatchObject({ requested: true })
    useCourseStore.setState({ pendingLaunch: { itemId: 'b', mode: 'resume' } })
    expect((await run('navigate', { direction: 'next' }))['error']).toMatch(/in progress/)
  })

  it('relaunches and restarts through the session', async () => {
    await run('relaunch_item')
    expect(session.relaunch).toHaveBeenCalled()
    await run('discard_and_restart', { scope: 'item' })
    expect(session.newAttempt).toHaveBeenCalled()
    await run('discard_and_restart', { scope: 'course' })
    expect(session.restartCourse).toHaveBeenCalled()
    expect((await run('discard_and_restart', { scope: 'all' }))['error']).toMatch(/scope must be/)
  })

  it('switches modes, but not to Advanced on a narrow window', async () => {
    expect(await run('set_view_mode', { mode: 'advanced' })).toEqual({ mode: 'advanced' })
    expect(mode).toBe('advanced')
    advanced = false
    expect((await run('set_view_mode', { mode: 'advanced' }))['error']).toMatch(/1024 px/)
  })
})
