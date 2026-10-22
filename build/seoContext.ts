/**
 * Build-time inputs to the SEO plugin that come from the deployment and the
 * repository rather than from `siteSeoConfig`: whether this deployment may be
 * indexed, when the site's content last changed, and the documents published
 * for AI assistants (llms.txt).
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** A repository document served as Markdown at the same path (`docs/user-guide.md`). */
export interface PublishedDoc {
  path: string
  title: string
  /** The document's opening paragraph, as plain text. */
  summary: string
  markdown: string
}

export interface SeoBuildContext {
  /** False for deployments search engines must not index (previews, staging). */
  indexable: boolean
  /** YYYY-MM-DD the site's content last changed — the sitemap's lastmod. */
  lastmod: string
  docs: readonly PublishedDoc[]
}

/**
 * Whether search engines may index this deployment: `SEO_INDEX=false` (or
 * `VITE_SEO_INDEX`) turns it off, `true` forces it on; otherwise Vercel
 * preview and development builds are not indexed, everything else is.
 */
export function resolveIndexing(env: Readonly<Record<string, string | undefined>>): boolean {
  const explicit = env['SEO_INDEX'] || env['VITE_SEO_INDEX']
  if (explicit) return !['false', '0', 'no'].includes(explicit.toLowerCase())
  if (env['VERCEL_ENV']) return env['VERCEL_ENV'] === 'production'
  return true
}

/**
 * Date of the last commit that touched `paths`, or null without git history
 * (a container build that leaves out `.git`, or a source tarball).
 */
export function lastChangeDate(root: string, paths: readonly string[]): string | null {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  } catch {
    return null
  }
}

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

/** Title (the `# ` heading) and opening paragraph of a Markdown document. */
export function parseDoc(docPath: string, markdown: string): PublishedDoc {
  const lines = markdown.split(/\r?\n/)
  const titleAt = lines.findIndex((line) => line.startsWith('# '))
  if (titleAt === -1) throw new Error(`${docPath}: a published document needs a "# " title`)
  const paragraph: string[] = []
  for (const line of lines.slice(titleAt + 1)) {
    if (line.trim() === '') {
      if (paragraph.length > 0) break
      continue
    }
    if (line.startsWith('#')) break
    paragraph.push(line.trim())
  }
  if (paragraph.length === 0) throw new Error(`${docPath}: a published document needs an opening paragraph`)
  return {
    path: docPath,
    title: lines[titleAt]!.slice(2).trim(),
    summary: paragraph.join(' ').replace(MARKDOWN_LINK, '$1'),
    markdown,
  }
}

/**
 * Relative links in a published document must point at another published
 * document — anything else would be a broken link on the site.
 */
export function brokenDocLinks(docs: readonly PublishedDoc[]): string[] {
  const published = new Set(docs.map((doc) => doc.path))
  const broken: string[] = []
  for (const doc of docs) {
    for (const [, , target] of doc.markdown.matchAll(MARKDOWN_LINK)) {
      if (!target || /^[a-z]+:/i.test(target) || target.startsWith('#')) continue
      const file = path.posix.join(path.posix.dirname(doc.path), target.split('#')[0]!)
      if (!published.has(file)) broken.push(`${doc.path} → ${target}`)
    }
  }
  return broken
}

export function readPublishedDocs(root: string, docPaths: readonly string[]): PublishedDoc[] {
  const docs = docPaths.map((docPath) => parseDoc(docPath, readFileSync(path.join(root, docPath), 'utf8')))
  const broken = brokenDocLinks(docs)
  if (broken.length > 0) {
    throw new Error(`Published documents link to unpublished files:\n  ${broken.join('\n  ')}`)
  }
  return docs
}
