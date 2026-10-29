/**
 * What the IndexNow script submits: the sitemap's pages, compared by a
 * fingerprint that ignores what changes with every build.
 */

import { describe, expect, it } from 'vitest'
import { fingerprint, pagesToSubmit, sitemapUrls } from './indexnow.js'
import { renderSitemapXml } from './seoPlugin.js'

const page = (assets: string, body: string) =>
  `<!doctype html><html><head>
    <script type="module" crossorigin src="/assets/index-${assets}.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-${assets}.js">
    <link rel="stylesheet" crossorigin href="/assets/index-${assets}.css">
    <link rel="icon" href="/logo.svg">
  </head><body>${body}</body></html>`

const BUILD = { commit: 'abcdef1', builtAt: '2026-10-30 09:30 UTC' }

describe('sitemapUrls', () => {
  it('reads every page of the sitemap the build emits', () => {
    const xml = renderSitemapXml(['/', '/about/', '/a?b&c'], 'https://example.test', '2026-10-30')
    expect(sitemapUrls(xml)).toEqual([
      'https://example.test/',
      'https://example.test/about/',
      'https://example.test/a?b&c',
    ])
  })

  it('finds no pages in something that is not a sitemap (the SPA fallback)', () => {
    expect(sitemapUrls('<!doctype html><div id="root"></div>')).toEqual([])
  })
})

describe('fingerprint', () => {
  it('ignores the hashed asset links a new build renames', () => {
    expect(fingerprint(page('aaa111', '<p>Hi</p>'), null)).toBe(fingerprint(page('bbb222', '<p>Hi</p>'), null))
  })

  it("ignores the build's commit and time on the About page", () => {
    const about = (build: typeof BUILD) => page('a', `<dd>${build.commit}</dd><dd>${build.builtAt}</dd><p>Credits</p>`)
    const next = { commit: '1234567', builtAt: '2026-10-31 10:00 UTC' }
    expect(fingerprint(about(BUILD), BUILD)).toBe(fingerprint(about(next), next))
  })

  it('changes when the words do', () => {
    expect(fingerprint(page('a', '<p>Hi</p>'), BUILD)).not.toBe(fingerprint(page('a', '<p>Hello</p>'), BUILD))
  })

  it('changes when a link that is not a hashed asset does', () => {
    const icon = page('a', '').replace('/logo.svg', '/logo-2.svg')
    expect(fingerprint(page('a', ''), null)).not.toBe(fingerprint(icon, null))
  })
})

describe('pagesToSubmit', () => {
  const urls = ['https://example.test/', 'https://example.test/about/']
  const current = { [urls[0]!]: 'home-2', [urls[1]!]: 'about-1' }

  it('submits the pages that differ from any reference', () => {
    const before = { [urls[0]!]: 'home-1', [urls[1]!]: 'about-1' }
    expect(pagesToSubmit(urls, current, [before], false)).toEqual([urls[0]])
    // The last run's crawl still differs, e.g. its submission failed.
    expect(pagesToSubmit(urls, current, [current, { ...current, [urls[1]!]: 'about-0' }], false)).toEqual([urls[1]])
  })

  it('submits a page the reference did not have', () => {
    expect(pagesToSubmit(urls, current, [{ [urls[1]!]: 'about-1' }], false)).toEqual([urls[0]])
  })

  it('submits nothing without a reference, and everything when asked', () => {
    expect(pagesToSubmit(urls, current, [], false)).toEqual([])
    expect(pagesToSubmit(urls, current, [current], true)).toEqual(urls)
  })
})
