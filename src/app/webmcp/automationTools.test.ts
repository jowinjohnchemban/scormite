/**
 * The automation tools: calling the SCORM API the SCO sees, waiting for a
 * state, closing the package, and turning script results into JSON.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { useRuntimeStore } from '@/features/runtime'
import { createAutomationTools, toJsonResult } from './automationTools'
import type { ToolHost } from './tools'

let cmi: Record<string, string> = {}
const close = vi.fn()
const session = { pkg: { id: 'p1' }, close } as unknown as PackageSession
const host: ToolHost = {
  session: () => session,
  mode: () => 'basic',
  setMode: () => undefined,
  advancedAvailable: () => true,
}
const tools = createAutomationTools(host)
const run = (name: string, input: Record<string, unknown> = {}) =>
  tools.find((t) => t.name === name)!.execute(input, { signal: new AbortController().signal }) as Promise<
    Record<string, unknown>
  >
const w = window as unknown as Record<string, unknown>

afterEach(() => {
  delete w['API_1484_11']
  delete w['API']
  useRuntimeStore.getState().reset()
  cmi = {}
})

function startRuntime() {
  useRuntimeStore.setState({ adapter: { getFlattenedCmi: () => cmi } as never })
}

describe('call_scorm_api', () => {
  it('calls the SCORM 2004 API and reports the error', async () => {
    expect((await run('call_scorm_api', { method: 'GetValue', element: 'cmi.mode' }))['error']).toMatch(
      /No item is running/,
    )
    let lastError = '0'
    w['API_1484_11'] = {
      SetValue: (element: string, value: string) => {
        if (element === 'cmi.score.raw') {
          cmi[element] = value
          return 'true'
        }
        lastError = '401'
        return 'false'
      },
      GetLastError: () => lastError,
      GetErrorString: (code: string) => (code === '401' ? 'Undefined Data Model Element' : ''),
    }
    startRuntime()
    expect(await run('call_scorm_api', { method: 'SetValue', element: 'cmi.score.raw', value: '75' })).toEqual({
      method: 'SetValue',
      result: 'true',
      errorCode: '0',
    })
    expect(cmi['cmi.score.raw']).toBe('75')
    expect(await run('call_scorm_api', { method: 'SetValue', element: 'cmi.nope', value: 'x' })).toEqual({
      method: 'SetValue',
      result: 'false',
      errorCode: '401',
      errorString: 'Undefined Data Model Element',
    })
    expect((await run('call_scorm_api', { method: 'Explode' }))['error']).toMatch(/method must be/)
  })

  it('uses the LMS… names for SCORM 1.2', async () => {
    const calls: string[] = []
    w['API'] = {
      LMSFinish: (arg: string) => (calls.push(`LMSFinish(${arg})`), 'true'),
      LMSGetLastError: () => '0',
    }
    startRuntime()
    expect(await run('call_scorm_api', { method: 'Terminate' })).toMatchObject({ method: 'LMSFinish', result: 'true' })
    expect(calls).toEqual(['LMSFinish()'])
  })
})

describe('wait_for', () => {
  it('returns once a CMI element reaches the value, or times out', async () => {
    startRuntime()
    setTimeout(() => (cmi['cmi.completion_status'] = 'completed'), 300)
    expect(
      await run('wait_for', { element: 'cmi.completion_status', value: 'completed', timeoutMs: 2000 }),
    ).toMatchObject({ met: true })
    expect(await run('wait_for', { element: 'cmi.success_status', value: 'passed', timeoutMs: 100 })).toMatchObject({
      met: false,
      error: 'Not met within 100 ms.',
    })
    expect((await run('wait_for'))['error']).toMatch(/Give text, element/)
  })
})

describe('close_package', () => {
  it('closes the session', async () => {
    expect(await run('close_package')).toEqual({ closed: true })
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('open_package_from_url', () => {
  it('only accepts http(s) URLs', async () => {
    expect((await run('open_package_from_url', { url: 'file:///c:/course.zip' }))['error']).toMatch(/http/)
  })
})

describe('toJsonResult', () => {
  it('makes script results JSON-safe', () => {
    expect(toJsonResult(undefined)).toBeNull()
    expect(toJsonResult({ a: 1, b: [true] })).toEqual({ a: 1, b: [true] })
    const element = document.createElement('p')
    element.textContent = 'Hi'
    expect(toJsonResult(element)).toBe('<p>Hi</p>')
    const circular: Record<string, unknown> = {}
    circular['self'] = circular
    expect(toJsonResult(circular)).toBe('[object Object]')
    expect(toJsonResult('x'.repeat(60_000))).toMatchObject({ truncated: true })
  })
})
