/**
 * The content-review tools against a stand-in package: text extraction,
 * search, reference checks, assessment data, and review findings that join the
 * validation issues.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { useManifestStore } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { useRuntimeStore } from '@/features/runtime'
import { useValidationStore } from '@/features/validation'
import type { Manifest } from '@/shared/types'
import { createContentTools } from './contentTools'
import type { ToolHost } from './tools'

const FILES: Record<string, string> = {
  'index.html':
    '<html lang="en"><head><title>Intro</title><link href="css/site.css"></head><body><p>Teh course begins.</p><img src="img/logo.png" alt="Logo"><img src="img/missing.png"><script src="https://cdn.example.com/lib.js"></script></body></html>',
  'css/site.css': 'body { background: url("../img/bg.png") }',
  'img/logo.png': 'PNG',
  'captions/intro.vtt': 'WEBVTT\n\n00:00.000 --> 00:02.000\nWelcome to the course.',
  'js/app.js': 'const label = "Teh course"',
}

const session = { pkg: { id: 'p1', name: 'Course', scormVersion: '2004' } } as unknown as PackageSession
const host: ToolHost = {
  session: () => session,
  mode: () => 'basic',
  setMode: () => undefined,
  advancedAvailable: () => true,
}
const tools = createContentTools(host)
const run = (name: string, input: Record<string, unknown> = {}) =>
  tools.find((t) => t.name === name)!.execute(input, { signal: new AbortController().signal }) as Promise<
    Record<string, unknown>
  >

beforeEach(() => {
  usePackageStore.setState({ filePaths: Object.keys(FILES) })
  useManifestStore.setState({
    manifest: {
      metadata: { title: 'Safety course' },
      organizations: [
        {
          identifier: 'org',
          title: 'Safety',
          items: [{ identifier: 'i1', title: 'Intro', isvisible: true, children: [] }],
        },
      ],
      resources: [],
    } as unknown as Manifest,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = decodeURIComponent(url.replace(/^\/scorm-files\/p1\//, ''))
      const body = FILES[path]
      return body === undefined ? new Response('', { status: 404 }) : new Response(body, { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  useValidationStore.getState().reset()
  useRuntimeStore.getState().reset()
})

describe('content tools', () => {
  it('extracts the text of every page and caption, and the manifest titles', async () => {
    const result = await run('extract_course_text')
    expect(result['manifestTitles']).toEqual(['Safety course', 'Safety', 'Intro'])
    expect(result['files']).toEqual([
      { path: 'index.html', kind: 'page', title: 'Intro', lang: 'en', text: 'Teh course begins.', imageAlts: ['Logo'] },
      { path: 'captions/intro.vtt', kind: 'captions', text: 'Welcome to the course.' },
    ])
  })

  it('searches every text file and rejects an invalid regular expression', async () => {
    const result = await run('search_package', { query: 'teh course' })
    expect(result['matches']).toEqual([
      { file: 'index.html', line: 1, text: expect.stringContaining('Teh course begins.') },
      { file: 'js/app.js', line: 1, text: 'const label = "Teh course"' },
    ])
    expect((await run('search_package', { query: '(', regex: true }))['error']).toMatch(/Invalid regular expression/)
  })

  it('finds broken references and external dependencies', async () => {
    const result = await run('check_references')
    expect(result['broken']).toEqual([
      { file: 'index.html', reference: 'img/missing.png' },
      { file: 'css/site.css', reference: '../img/bg.png' },
    ])
    expect(result['external']).toEqual([{ url: 'https://cdn.example.com/lib.js', usedIn: ['index.html'] }])
  })

  it('reads the assessment from the running item', async () => {
    expect((await run('get_assessment_data'))['error']).toMatch(/No item is running/)
    useRuntimeStore.setState({
      adapter: {
        getFlattenedCmi: () => ({ 'cmi.interactions.0.id': 'q1', 'cmi.interactions.0.result': 'correct' }),
      } as never,
    })
    expect(await run('get_assessment_data')).toMatchObject({ interactions: [{ id: 'q1', result: 'correct' }] })
  })

  it('records review findings as validation issues, and clears only those', async () => {
    useValidationStore
      .getState()
      .addIssue({ id: 'm', severity: 'error', source: 'manifest', message: 'x', ruleId: 'r' })
    expect(
      await run('add_review_finding', {
        severity: 'warning',
        category: 'Spelling',
        message: '"Teh" should be "The".',
        location: 'index.html',
      }),
    ).toEqual({ recorded: true, reviewFindings: 1 })
    expect(useValidationStore.getState().issues.at(-1)).toMatchObject({
      source: 'review',
      ruleId: 'review.spelling',
      severity: 'warning',
      location: 'index.html',
    })
    expect((await run('add_review_finding', { severity: 'fatal', message: 'x' }))['error']).toMatch(/severity/)
    expect(await run('clear_review_findings')).toEqual({ removed: 1 })
    expect(useValidationStore.getState().issues.map((i) => i.id)).toEqual(['m'])
  })
})
