/**
 * SEO outputs rendered from `siteSeoConfig`: limits search engines truncate
 * at, structured data shape, and the generated text files.
 */

import { describe, expect, it } from 'vitest'
import { siteSeoConfig } from '../src/shared/config/seo.js'
import {
  renderLlmsTxt,
  renderRobotsTxt,
  renderSitemapXml,
  renderStaticContent,
  renderStructuredData,
  renderWebManifest,
} from './seoPlugin.js'

const ORIGIN = 'https://example.test'

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
    const robots = renderRobotsTxt(ORIGIN)
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Disallow: /scorm-files/')
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })

  it('sitemap.xml lists every route with lastmod', () => {
    const xml = renderSitemapXml(siteSeoConfig, ORIGIN, '2026-01-02')
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`)
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>')
  })

  it('llms.txt follows the llmstxt.org shape', () => {
    const txt = renderLlmsTxt(siteSeoConfig, ORIGIN)
    expect(txt.startsWith(`# ${siteSeoConfig.name}\n\n> `)).toBe(true)
    expect(txt).toContain('## Features')
    expect(txt).toContain('## FAQ')
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
