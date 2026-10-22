/**
 * Build-time SEO inputs: which deployments are indexed, and how published
 * documents are read and checked.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { siteSeoConfig } from '../src/shared/config/seo.js'
import { brokenDocLinks, lastChangeDate, parseDoc, readPublishedDocs, resolveIndexing } from './seoContext.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('resolveIndexing', () => {
  it('indexes by default', () => {
    expect(resolveIndexing({})).toBe(true)
  })

  it('follows Vercel: production is indexed, previews are not', () => {
    expect(resolveIndexing({ VERCEL_ENV: 'production' })).toBe(true)
    expect(resolveIndexing({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(resolveIndexing({ VERCEL_ENV: 'development' })).toBe(false)
  })

  it('lets SEO_INDEX decide, over the platform', () => {
    expect(resolveIndexing({ SEO_INDEX: 'false' })).toBe(false)
    expect(resolveIndexing({ VITE_SEO_INDEX: '0' })).toBe(false)
    expect(resolveIndexing({ SEO_INDEX: 'true', VERCEL_ENV: 'preview' })).toBe(true)
  })
})

describe('parseDoc', () => {
  it('takes the title and the opening paragraph as plain text', () => {
    const doc = parseDoc('docs/a.md', '# Title\n\nFirst line with a [link](b.md)\nand more.\n\nSecond paragraph.\n')
    expect(doc.title).toBe('Title')
    expect(doc.summary).toBe('First line with a link and more.')
  })

  it('rejects a document without a title or an opening paragraph', () => {
    expect(() => parseDoc('docs/a.md', 'No title\n')).toThrow(/title/)
    expect(() => parseDoc('docs/a.md', '# Title\n\n## Straight to a section\n')).toThrow(/opening paragraph/)
  })
})

describe('brokenDocLinks', () => {
  it('reports relative links to documents that are not published', () => {
    const docs = [
      parseDoc('docs/a.md', '# A\n\nSee [B](b.md#x), [C](c.md), [web](https://x.test), [here](#top).\n'),
      parseDoc('docs/b.md', '# B\n\nBack to [A](a.md).\n'),
    ]
    expect(brokenDocLinks(docs)).toEqual(['docs/a.md → c.md'])
  })
})

describe('the configured published docs', () => {
  it('exist, have a title and summary, and link only to each other', () => {
    const docs = readPublishedDocs(root, siteSeoConfig.docs)
    expect(docs.map((doc) => doc.path)).toEqual(siteSeoConfig.docs)
    for (const doc of docs) expect(doc.summary.length).toBeGreaterThan(20)
  })
})

describe('lastChangeDate', () => {
  it('is a date from git history, or null outside a repository', () => {
    const date = lastChangeDate(root, ['src'])
    if (date !== null) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(lastChangeDate(path.parse(root).root, ['src'])).toBeNull()
  })
})
