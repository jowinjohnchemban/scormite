/**
 * SEO outputs rendered from `siteSeoConfig`: limits search engines truncate
 * at, structured data shape, and the generated text files.
 */

import { describe, expect, it } from 'vitest'
import { siteSeoConfig } from '../src/shared/config/seo.js'
import { parseDoc } from './seoContext.js'
import {
  absolutizeLinks,
  pagesFromHtmlFiles,
  renderLlmsFullTxt,
  renderLlmsTxt,
  renderRobotsTxt,
  renderSitemapXml,
  renderStaticContent,
  renderStructuredData,
  renderWebManifest,
} from './seoPlugin.js'

const ORIGIN = 'https://example.test'
const DOCS = [
  parseDoc(
    'docs/guide.md',
    '# Guide\n\nHow to [test](other.md#x) a package.\n\n## One\n\nSee [this](#one) and [scorm-again](https://example.org/a).\n',
  ),
  parseDoc('docs/other.md', '# Other\n\nMore detail.\n\n## X\n'),
]

describe('siteSeoConfig', () => {
  it('keeps the title and description within search-result display limits', () => {
    expect(siteSeoConfig.title.length).toBeLessThanOrEqual(65)
    expect(siteSeoConfig.description.length).toBeLessThanOrEqual(165)
  })

  it('has features and FAQs to index', () => {
    expect(siteSeoConfig.features.length).toBeGreaterThan(3)
    expect(siteSeoConfig.faqs.length).toBeGreaterThan(3)
  })
})

describe('renderStructuredData', () => {
  const data = renderStructuredData(siteSeoConfig, ORIGIN) as { '@graph': Record<string, unknown>[] }

  it('describes the site, the web application, and the FAQ', () => {
    expect(data['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'WebApplication', 'FAQPage'])
  })

  it('uses absolute URLs and lists every FAQ as a question', () => {
    const app = data['@graph'][1]
    expect(app?.['url']).toBe(`${ORIGIN}/`)
    expect(app?.['image']).toBe(`${ORIGIN}/og-image.png`)
    const faq = data['@graph'][2] as { mainEntity: { name: string }[] }
    expect(faq.mainEntity.map((q) => q.name)).toEqual(siteSeoConfig.faqs.map((f) => f.question))
  })
})

describe('generated files', () => {
  it('robots.txt allows the app, hides package paths, and points to the sitemap', () => {
    const robots = renderRobotsTxt(ORIGIN, true)
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Disallow: /scorm-files/')
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })

  it('robots.txt shuts out crawlers on a deployment that must not be indexed', () => {
    expect(renderRobotsTxt(ORIGIN, false)).toBe('User-agent: *\nDisallow: /\n')
  })

  it('sitemap.xml lists every page with lastmod', () => {
    const xml = renderSitemapXml(['/', '/about/'], ORIGIN, '2026-01-02')
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`)
    expect(xml).toContain(`<loc>${ORIGIN}/about/</loc>`)
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>')
  })

  it('the sitemap pages are the emitted HTML files, without the 404 page or other assets', () => {
    expect(pagesFromHtmlFiles(['index.html', 'assets/app.js', 'guide/index.html', 'pricing.html', '404.html'])).toEqual(
      ['/', '/guide/', '/pricing'],
    )
  })

  it('llms.txt follows the llmstxt.org shape and links each published doc with its summary', () => {
    const txt = renderLlmsTxt(siteSeoConfig, ORIGIN, DOCS)
    expect(txt.startsWith(`# ${siteSeoConfig.name}\n\n> `)).toBe(true)
    expect(txt).toContain(`- [Guide](${ORIGIN}/docs/guide.md): How to test a package.`)
    expect(txt).toContain(`- [Other](${ORIGIN}/docs/other.md): More detail.`)
    expect(txt).toContain(`(${ORIGIN}/llms-full.txt)`)
    expect(txt).toContain('## Features')
    expect(txt).toContain('## FAQ')
  })

  it('llms-full.txt carries the full text of every doc, with links that work outside docs/', () => {
    const txt = renderLlmsFullTxt(siteSeoConfig, ORIGIN, DOCS)
    expect(txt).toContain(`Source: ${ORIGIN}/docs/guide.md`)
    expect(txt).toContain('## One')
    expect(txt).toContain(`Source: ${ORIGIN}/docs/other.md`)
    expect(txt).toContain(`[test](${ORIGIN}/docs/other.md#x)`)
  })

  it('absolute links stay as they are; in-page anchors point at their document', () => {
    const markdown = absolutizeLinks(DOCS[0]!, ORIGIN)
    expect(markdown).toContain('[scorm-again](https://example.org/a)')
    expect(markdown).toContain(`[this](${ORIGIN}/docs/guide.md#one)`)
  })

  it('the web app manifest references square icons', () => {
    const manifest = JSON.parse(renderWebManifest(siteSeoConfig)) as { icons: { sizes: string }[] }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512'])
  })

  it('the static fallback escapes text and carries the headline', () => {
    const html = renderStaticContent({ ...siteSeoConfig, headline: 'A <b> & "c"' })
    expect(html).toContain('<h1>A &lt;b&gt; &amp; &quot;c&quot;</h1>')
  })
})
