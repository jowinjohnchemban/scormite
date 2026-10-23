/**
 * The security tools against a stand-in package: the scan reads every file
 * (text in full, others by their first bytes), can record its findings, and
 * files are hashed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { usePackageStore } from '@/features/package-loader'
import { useValidationStore } from '@/features/validation'
import { createSecurityTools, head } from './securityTools'
import type { ToolHost } from './tools'

const FILES: Record<string, string | Uint8Array<ArrayBuffer>> = {
  'index.html': '<html><body><p>Hello</p><input type="password"></body></html>',
  'js/app.js': 'eval(unescape("%61%6c%65%72%74"))',
  'img/logo.png': new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
  'tools/setup.exe': new Uint8Array([0x4d, 0x5a]),
  'abc.txt': 'abc',
}

const session = { pkg: { id: 'p1' } } as unknown as PackageSession
const host: ToolHost = {
  session: () => session,
  mode: () => 'basic',
  setMode: () => undefined,
  advancedAvailable: () => true,
}
const tools = createSecurityTools(host)
const run = (name: string, input: Record<string, unknown> = {}) =>
  tools.find((t) => t.name === name)!.execute(input, { signal: new AbortController().signal }) as Promise<
    Record<string, unknown>
  >

beforeEach(() => {
  usePackageStore.setState({ filePaths: Object.keys(FILES) })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = FILES[decodeURIComponent(url.replace(/^\/scorm-files\/p1\//, ''))]
      return body === undefined ? new Response('', { status: 404 }) : new Response(body, { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  useValidationStore.getState().reset()
})

describe('security tools', () => {
  it('scans every file and summarises the findings', async () => {
    const result = await run('scan_package_security')
    expect(result['scannedFiles']).toBe(5)
    expect(result['summary']).toEqual({ error: 2, warning: 2, info: 0 })
    expect((result['findings'] as { rule: string; file: string }[]).map((f) => `${f.rule} ${f.file}`).sort()).toEqual([
      'disguised-executable img/logo.png',
      'executable-file tools/setup.exe',
      'obfuscated-eval js/app.js',
      'password-field index.html',
    ])
    expect(useValidationStore.getState().issues).toEqual([])
  })

  it('reports a file it cannot read and scans the rest', async () => {
    usePackageStore.setState({ filePaths: ['broken.js', 'js/app.js'] })
    const fetchMock = vi.mocked(fetch)
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('broken.js') ? Promise.reject(new TypeError('network')) : original(url),
    )
    const result = await run('scan_package_security')
    expect(result).toMatchObject({ scannedFiles: 1, unreadable: ['broken.js'], summary: { warning: 1 } })
  })

  it('reads at least four bytes for signatures that span chunks', async () => {
    const chunks = [new Uint8Array([0x7f, 0x45]), new Uint8Array([0x4c, 0x46, 0x02])]
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift()
        if (chunk) controller.enqueue(chunk)
        else controller.close()
      },
    })
    expect([...(await head(new Response(body)))]).toEqual([0x7f, 0x45, 0x4c, 0x46, 0x02])
  })

  it('records the findings as review issues when asked', async () => {
    await run('scan_package_security', { prefix: 'js/', record: true })
    await run('scan_package_security', { prefix: 'js/', record: true }) // replaces, not duplicates
    expect(useValidationStore.getState().issues).toEqual([
      expect.objectContaining({
        source: 'review',
        severity: 'warning',
        ruleId: 'review.security.obfuscated-eval',
        location: 'js/app.js:1',
      }),
    ])
  })

  it('hashes the requested files', async () => {
    const result = await run('get_file_hashes', { paths: ['abc.txt', 'nope.txt'] })
    expect(result['files']).toEqual([
      { path: 'abc.txt', size: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
      { path: 'nope.txt', error: 'Not in the package.' },
    ])
  })
})
