/**
 * WebMCP tools for reviewing a package's content and recording what an agent
 * finds: every page's and caption's text (for grammar, spelling, tone, and
 * consistency review by the agent's own model), search across the package,
 * static reference checks, the assessment data the SCO reports, and review
 * findings that join the Validation panel and the QA report.
 */

import { useManifestStore } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { packageLaunchUrl } from '@/features/player'
import { useRuntimeStore } from '@/features/runtime'
import { useValidationStore } from '@/features/validation'
import type { ValidationSeverity } from '@/shared/types'
import { assessmentFromCmi } from './assessment'
import {
  CAPTION_FILE,
  PAGE_FILE,
  STYLE_FILE,
  TEXT_FILE,
  captionText,
  cssReferences,
  htmlReferences,
  pageText,
  resolveReference,
  searchLines,
  type SearchMatch,
} from './contentScan'
import type { ModelContextTool } from './modelContext'
import { readBounded } from './readBounded'
import type { ToolHost } from './tools'

const NO_PACKAGE = { error: 'No package is open. Ask the user to drop a SCORM .zip on the SCORMite page.' }
const untrustedRead = { readOnlyHint: true, untrustedContentHint: true }
/** Larger files are skipped by the package-wide scans. */
const MAX_SCAN_BYTES = 2_000_000

const string = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const bounded = (value: unknown, fallback: number, max: number) =>
  Math.min(Math.max(Math.trunc(Number(value)) || fallback, 1), max)

async function readText(packageId: string, path: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(packageLaunchUrl(packageId, path), { signal })
    if (!response.ok) return null
    const bytes = await readBounded(response, MAX_SCAN_BYTES)
    return bytes && new TextDecoder().decode(bytes)
  } catch (error) {
    if (signal.aborted) throw error
    return null // an unreadable file is skipped, not the whole scan
  }
}

export function createContentTools(host: ToolHost): ModelContextTool[] {
  return [
    {
      name: 'extract_course_text',
      title: 'Extract all the course text',
      description:
        "The readable text of the whole package for content review — every HTML page (title, language, text, image alt text) and every caption file, plus the manifest's titles — without launching anything. Use it to review grammar, spelling, tone, terminology, and consistency; record problems with add_review_finding. Text built by scripts at run time is not included: use read_sco_page for the running page. The text has a budget: files cut short are marked truncated and files left out are listed in notIncluded — review those with prefix before reporting a complete review.",
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Only files whose path starts with this' },
          maxChars: {
            type: 'integer',
            minimum: 1000,
            maximum: 300000,
            description: 'Total text budget, default 60000',
          },
        },
      },
      annotations: untrustedRead,
      execute: async (input, { signal }) => {
        const session = host.session()
        const manifest = useManifestStore.getState().manifest
        if (!session.pkg || !manifest) return NO_PACKAGE
        const prefix = string(input['prefix']) ?? ''
        let budget = bounded(input['maxChars'], 60000, 300000)
        const files: Record<string, unknown>[] = []
        const skipped: string[] = []
        for (const path of usePackageStore.getState().filePaths) {
          if (!path.startsWith(prefix) || !(PAGE_FILE.test(path) || CAPTION_FILE.test(path))) continue
          if (budget <= 0) {
            skipped.push(path)
            continue
          }
          const raw = await readText(session.pkg.id, path, signal)
          if (raw === null) {
            skipped.push(path)
            continue
          }
          if (CAPTION_FILE.test(path)) {
            const full = captionText(raw)
            const text = full.slice(0, budget)
            budget -= text.length
            if (text) {
              files.push({ path, kind: 'captions', text, ...(text.length < full.length ? { truncated: true } : {}) })
            }
          } else {
            const page = pageText(raw)
            const text = page.text.slice(0, budget)
            budget -= text.length
            files.push({
              path,
              kind: 'page',
              ...(page.title ? { title: page.title } : {}),
              ...(page.lang ? { lang: page.lang } : {}),
              text,
              ...(text.length < page.text.length ? { truncated: true } : {}),
              ...(page.imageAlts.length ? { imageAlts: page.imageAlts } : {}),
            })
          }
        }
        const titles: string[] = [manifest.metadata.title ?? ''].filter(Boolean)
        const walk = (items: (typeof manifest.organizations)[number]['items']) => {
          for (const item of items) {
            titles.push(item.title)
            walk(item.children)
          }
        }
        for (const organization of manifest.organizations) {
          titles.push(organization.title)
          walk(organization.items)
        }
        return {
          manifestTitles: titles.filter(Boolean),
          files,
          ...(skipped.length
            ? { notIncluded: skipped, note: 'Over the text budget or too large; narrow with prefix.' }
            : {}),
        }
      },
    },
    {
      name: 'search_package',
      title: 'Search the package',
      description:
        'Search the text of every package file (HTML, JavaScript, CSS, XML, JSON, captions, …) for a word, phrase, or regular expression; returns each matching line with its file and line number. Use it to check terminology and consistency, find where a value or asset is used, or locate a string to fix.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          regex: { type: 'boolean', description: 'Treat query as a regular expression' },
          caseSensitive: { type: 'boolean' },
          prefix: { type: 'string', description: 'Only files whose path starts with this' },
          maxResults: { type: 'integer', minimum: 1, maximum: 500, description: 'Default 100' },
        },
        required: ['query'],
      },
      annotations: untrustedRead,
      execute: async (input, { signal }) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const query = string(input['query'])
        if (!query) return { error: 'query is required.' }
        let matcher: RegExp
        try {
          const source = input['regex'] === true ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          matcher = new RegExp(source, input['caseSensitive'] === true ? 'g' : 'gi')
        } catch (error) {
          return { error: `Invalid regular expression: ${(error as Error).message}` }
        }
        const prefix = string(input['prefix']) ?? ''
        const limit = bounded(input['maxResults'], 100, 500)
        const matches: SearchMatch[] = []
        let searched = 0
        for (const path of usePackageStore.getState().filePaths) {
          if (matches.length >= limit) break
          if (!path.startsWith(prefix) || !TEXT_FILE.test(path)) continue
          const text = await readText(session.pkg.id, path, signal)
          if (text === null) continue
          searched++
          matches.push(...searchLines(path, text, matcher, limit - matches.length))
        }
        return { searchedFiles: searched, matches, ...(matches.length >= limit ? { truncated: true } : {}) }
      },
    },
    {
      name: 'check_references',
      title: 'Check file references',
      description:
        'Statically check every HTML page and stylesheet in the package: references (src, href, srcset, poster, CSS url() and @import) to package files that do not exist, and references to external sites the course depends on. Complements get_network, which only sees what the running course actually requested.',
      inputSchema: { type: 'object', properties: {} },
      annotations: untrustedRead,
      execute: async (_input, { signal }) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const files = usePackageStore.getState().filePaths
        const present = new Set(files)
        const broken: { file: string; reference: string }[] = []
        const external = new Map<string, string[]>()
        let checked = 0
        for (const path of files) {
          const page = PAGE_FILE.test(path)
          if (!page && !STYLE_FILE.test(path)) continue
          const text = await readText(session.pkg.id, path, signal)
          if (text === null) continue
          checked++
          for (const reference of page ? htmlReferences(text) : cssReferences(text)) {
            const resolved = resolveReference(path, reference)
            if (resolved?.kind === 'package' && !present.has(resolved.path)) broken.push({ file: path, reference })
            if (resolved?.kind === 'external') external.set(resolved.url, [...(external.get(resolved.url) ?? []), path])
          }
        }
        return {
          checkedFiles: checked,
          broken,
          external: [...external].map(([url, usedIn]) => ({ url, usedIn: [...new Set(usedIn)] })),
          note: 'References built by scripts at run time are not checked here; get_network shows those.',
        }
      },
    },
    {
      name: 'get_assessment_data',
      title: 'Read the quiz and objectives data',
      description:
        "What the running item reports about its assessment: each interaction (question id, type, description, correct responses, the learner's response, result, weighting, latency, objectives), each objective (status, success, completion, score), and the overall score. Use it to check that answers are recorded and judged correctly.",
      inputSchema: { type: 'object', properties: {} },
      annotations: untrustedRead,
      execute: async () => {
        if (!host.session().pkg) return NO_PACKAGE
        const adapter = useRuntimeStore.getState().adapter
        if (!adapter) return { error: 'No item is running yet. Use launch_item first.' }
        return assessmentFromCmi(adapter.getFlattenedCmi())
      },
    },
    {
      name: 'add_review_finding',
      title: 'Record a review finding',
      description:
        'Record something the review found — a grammar or spelling mistake, unclear or inconsistent wording, a wrong answer key, an accessibility or logic problem, or anything the user asked to check. It appears in the Validation panel and the QA report (get_report) as a "review" issue. Give a clear message, where it is, and a fix.',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['error', 'warning', 'suggestion'] },
          category: {
            type: 'string',
            description: 'Short kebab-case kind, e.g. grammar, spelling, wording, accessibility, assessment, logic',
          },
          message: { type: 'string', description: 'What is wrong and how to fix it' },
          location: { type: 'string', description: 'Where: file, page, item, or question' },
        },
        required: ['severity', 'message'],
      },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const severity = input['severity']
        if (severity !== 'error' && severity !== 'warning' && severity !== 'suggestion') {
          return { error: 'severity must be error, warning, or suggestion.' }
        }
        const message = string(input['message'])?.trim()
        if (!message) return { error: 'message is required.' }
        const category =
          (string(input['category']) ?? 'content').toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'content'
        const location = string(input['location'])?.trim()
        useValidationStore.getState().addIssue({
          id: `review-${crypto.randomUUID()}`,
          severity: severity as ValidationSeverity,
          source: 'review',
          message: message.slice(0, 2000),
          ruleId: `review.${category}`,
          ...(location ? { location: location.slice(0, 500) } : {}),
        })
        return {
          recorded: true,
          reviewFindings: useValidationStore.getState().issues.filter((issue) => issue.source === 'review').length,
        }
      },
    },
    {
      name: 'clear_review_findings',
      title: 'Clear review findings',
      description: 'Remove every finding recorded with add_review_finding (packaging and runtime issues stay).',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const store = useValidationStore.getState()
        const review = store.issues.filter((issue) => issue.source === 'review')
        for (const issue of review) store.removeIssue(issue.id)
        return { removed: review.length }
      },
    },
  ]
}
