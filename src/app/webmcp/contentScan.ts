/**
 * Static reading of package files for content review: the readable text of
 * HTML pages and caption files, the files HTML and CSS reference, and how a
 * reference resolves (a package file, an external URL, or nothing to check).
 */

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

export const PAGE_FILE = /\.(x?html?)$/i
export const CAPTION_FILE = /\.(vtt|srt)$/i
export const STYLE_FILE = /\.css$/i
/** Files whose text is worth searching. */
export const TEXT_FILE = /\.(html?|xhtml|xml|xsd|js|mjs|cjs|json|css|txt|md|csv|svg|vtt|srt)$/i

export interface PageText {
  title: string
  lang: string
  text: string
  /** Alternative text of images, in order (empty string for alt=""). */
  imageAlts: string[]
}

const BLOCK =
  'address, article, aside, blockquote, br, button, dd, details, div, dl, dt, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, label, li, main, nav, ol, option, p, pre, section, summary, table, td, th, tr, ul'

/** The text a reader sees on an HTML page: no scripts, styles, or hidden content. */
export function pageText(html: string): PageText {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const node of doc.querySelectorAll('script, style, noscript, template, [hidden], [aria-hidden="true"]')) {
    node.remove()
  }
  // Keep words in neighbouring blocks apart: textContent runs "<p>A</p><p>B</p>" together as "AB".
  for (const block of doc.body?.querySelectorAll(BLOCK) ?? []) {
    block.before(' ')
    block.after(' ')
  }
  return {
    title: clean(doc.title),
    lang: clean(doc.documentElement.getAttribute('lang')),
    text: clean(doc.body?.textContent),
    imageAlts: [...doc.querySelectorAll('img')].map((img) => img.getAttribute('alt') ?? '').filter((alt) => alt),
  }
}

/** The spoken text of a WebVTT or SRT caption file, without cue numbers or timings. */
export function captionText(text: string): string {
  const cues = text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    const timing = trimmed.includes(' --> ')
    return !(timing || /^\d+$/.test(trimmed) || /^(WEBVTT|NOTE|STYLE|REGION)\b/.test(trimmed))
  })
  // Cue text can carry markup (<v Narrator>, <i>); keep only its text.
  return clean(new DOMParser().parseFromString(cues.join('\n'), 'text/html').body.textContent)
}

const URL_IN_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g

/** The URLs a stylesheet references (url() and @import). */
export function cssReferences(css: string): string[] {
  return [...css.matchAll(URL_IN_CSS)].map((match) => (match[2] ?? match[4] ?? '').trim()).filter(Boolean)
}

const REFERENCE_ATTRIBUTES = ['src', 'href', 'poster', 'data', 'action', 'background']

/** The URLs an HTML page references: src/href-style attributes, srcset, and inline CSS. */
export function htmlReferences(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const references: string[] = []
  for (const element of doc.querySelectorAll('*')) {
    for (const attribute of REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute)
      if (value !== null && !(attribute === 'href' && element.tagName === 'BASE')) references.push(value.trim())
    }
    const srcset = element.getAttribute('srcset')
    if (srcset) references.push(...srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? ''))
    const style = element.getAttribute('style')
    if (style) references.push(...cssReferences(style))
  }
  for (const style of doc.querySelectorAll('style')) references.push(...cssReferences(style.textContent ?? ''))
  return references.filter(Boolean)
}

export type ResolvedReference = { kind: 'package'; path: string } | { kind: 'external'; url: string } | null

/** Where a reference from `fromPath` points; null for anchors, data:, javascript:, mailto:, and the like. */
export function resolveReference(fromPath: string, reference: string): ResolvedReference {
  const ref = reference.trim()
  if (!ref || ref.startsWith('#') || /^(data|javascript|mailto|tel|blob|about):/i.test(ref)) return null
  if (/^(https?:)?\/\//i.test(ref)) return { kind: 'external', url: ref }
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return null
  if (/\$\{|\{\{|<%/.test(ref)) return null // a template placeholder, not a file
  const pathOnly = ref.split(/[?#]/)[0] ?? ''
  if (!pathOnly) return null
  const base = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : ''
  const parts: string[] = []
  for (const segment of (pathOnly.startsWith('/') ? pathOnly.slice(1) : base + pathOnly).split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  let path = parts.join('/')
  try {
    path = decodeURIComponent(path)
  } catch {
    // Keep the raw path when it is not valid percent-encoding.
  }
  return { kind: 'package', path }
}

export interface SearchMatch {
  file: string
  line: number
  text: string
}

/** Lines of `text` that match, with their 1-based line numbers. */
export function searchLines(file: string, text: string, matcher: RegExp, limit: number): SearchMatch[] {
  const matches: SearchMatch[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length && matches.length < limit; i++) {
    const line = lines[i] ?? ''
    matcher.lastIndex = 0
    if (matcher.test(line)) matches.push({ file, line: i + 1, text: clean(line).slice(0, 240) })
  }
  return matches
}
