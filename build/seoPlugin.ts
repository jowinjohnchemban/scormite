/**
 * Vite plugin that renders every search / social / AI-assistant artifact
 * from `siteSeoConfig`:
 *
 *  - index.html head: title, description, keywords, canonical, robots,
 *    Open Graph, Twitter card, web app manifest link, JSON-LD
 *    (WebSite + WebApplication + FAQPage)
 *  - index.html body: a crawlable, no-JS fallback inside #root (the same
 *    headline, features, and FAQ the app renders on its landing screen);
 *    React replaces it on mount
 *  - robots.txt, sitemap.xml, llms.txt, manifest.webmanifest — served by the
 *    dev server and emitted into the build
 */

import type { Plugin } from 'vite'
import type { SiteSeoConfig } from '../src/shared/config/seo.js'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON safe to inline in a <script> element. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function absoluteUrl(origin: string, path: string): string {
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

export function renderStructuredData(config: SiteSeoConfig, origin: string): unknown {
  const url = `${origin}/`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: config.name,
        url,
        description: config.description,
        inLanguage: 'en',
      },
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: config.name,
        url,
        description: config.summary,
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'SCORM e-learning package testing',
        operatingSystem: 'Any — runs in a modern web browser',
        browserRequirements: 'Requires JavaScript and Service Worker support',
        image: absoluteUrl(origin, config.ogImage),
        featureList: config.features.map((f) => f.title),
        keywords: config.keywords.join(', '),
        inLanguage: 'en',
        isPartOf: { '@id': `${url}#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: config.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  }
}

/** The crawlable fallback rendered inside #root before (or without) JavaScript. */
export function renderStaticContent(config: SiteSeoConfig): string {
  const features = config.features
    .map((f) => `<li><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.description)}</p></li>`)
    .join('')
  const faqs = config.faqs
    .map((f) => `<dt>${escapeHtml(f.question)}</dt><dd>${escapeHtml(f.answer)}</dd>`)
    .join('')
  return `<div class="seo-fallback">
      <h1>${escapeHtml(config.headline)}</h1>
      <p>${escapeHtml(config.summary)}</p>
      <noscript><p><strong>SCORMite runs entirely in your browser and needs JavaScript enabled.</strong></p></noscript>
      <h2>What you can do with ${escapeHtml(config.name)}</h2>
      <ul>${features}</ul>
      <h2>Frequently asked questions</h2>
      <dl>${faqs}</dl>
    </div>`
}

export function renderRobotsTxt(origin: string): string {
  // /scorm-files/ is the service worker's virtual path for unzipped packages:
  // per-session, never real pages.
  return `User-agent: *\nAllow: /\nDisallow: /scorm-files/\n\nSitemap: ${origin}/sitemap.xml\n`
}

export function renderSitemapXml(config: SiteSeoConfig, origin: string, lastmod: string): string {
  const urls = config.routes
    .map((route) => {
      const loc = absoluteUrl(origin, route)
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** llms.txt per https://llmstxt.org — what the site is, for AI assistants. */
export function renderLlmsTxt(config: SiteSeoConfig, origin: string): string {
  const features = config.features.map((f) => `- **${f.title}**: ${f.description}`).join('\n')
  const faqs = config.faqs.map((f) => `### ${f.question}\n\n${f.answer}`).join('\n\n')
  return `# ${config.name}

> ${config.description}

${config.summary}

## App

- [${config.name}](${origin}/): open the app and drop a SCORM .zip to start

## Features

${features}

## FAQ

${faqs}
`
}

export function renderWebManifest(config: SiteSeoConfig): string {
  return `${JSON.stringify(
    {
      name: `${config.name} — SCORM tester & debugger`,
      short_name: config.name,
      description: config.description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: config.backgroundColor,
      theme_color: config.themeColor,
      categories: ['developer', 'education', 'productivity'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    null,
    2,
  )}\n`
}

export function createSeoPlugin(config: SiteSeoConfig): Plugin {
  const origin = config.siteUrl.replace(/\/$/, '')
  const canonical = `${origin}/`
  const ogImage = absoluteUrl(origin, config.ogImage)
  const lastmod = new Date().toISOString().slice(0, 10)

  const files: Record<string, { contentType: string; source: string }> = {
    'robots.txt': { contentType: 'text/plain; charset=utf-8', source: renderRobotsTxt(origin) },
    'sitemap.xml': {
      contentType: 'application/xml; charset=utf-8',
      source: renderSitemapXml(config, origin, lastmod),
    },
    'llms.txt': { contentType: 'text/markdown; charset=utf-8', source: renderLlmsTxt(config, origin) },
    'manifest.webmanifest': {
      contentType: 'application/manifest+json; charset=utf-8',
      source: renderWebManifest(config),
    },
  }

  const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const })

  return {
    name: 'scormite-seo',
    transformIndexHtml(html) {
      const updated = html
        .replace(/<title>.*<\/title>/, `<title>${escapeHtml(config.title)}</title>`)
        .replace(
          /<meta name="description" content=".*"\s*\/?>/,
          `<meta name="description" content="${escapeHtml(config.description)}" />`,
        )
        .replace('<div id="root"></div>', `<div id="root">${renderStaticContent(config)}</div>`)

      return {
        html: updated,
        tags: [
          meta({ name: 'keywords', content: config.keywords.join(', ') }),
          meta({ name: 'robots', content: 'index, follow, max-image-preview:large' }),
          { tag: 'link', attrs: { rel: 'canonical', href: canonical }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
          meta({ name: 'theme-color', content: config.themeColor }),
          meta({ name: 'color-scheme', content: 'dark' }),
          meta({ name: 'application-name', content: config.name }),
          meta({ name: 'apple-mobile-web-app-title', content: config.name }),
          meta({ property: 'og:site_name', content: config.name }),
          meta({ property: 'og:title', content: config.title }),
          meta({ property: 'og:description', content: config.description }),
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:url', content: canonical }),
          meta({ property: 'og:locale', content: config.locale }),
          meta({ property: 'og:image', content: ogImage }),
          meta({ property: 'og:image:type', content: 'image/png' }),
          meta({ property: 'og:image:width', content: '1200' }),
          meta({ property: 'og:image:height', content: '630' }),
          meta({ property: 'og:image:alt', content: config.ogImageAlt }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
          meta({ name: 'twitter:site', content: config.twitterSite }),
          meta({ name: 'twitter:creator', content: config.twitterCreator }),
          meta({ name: 'twitter:title', content: config.title }),
          meta({ name: 'twitter:description', content: config.description }),
          meta({ name: 'twitter:image', content: ogImage }),
          meta({ name: 'twitter:image:alt', content: config.ogImageAlt }),
          {
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: inlineJson(renderStructuredData(config, origin)),
            injectTo: 'head',
          },
        ],
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url ? files[req.url.replace(/^\//, '').split('?')[0] ?? ''] : undefined
        if (!file) return next()
        res.statusCode = 200
        res.setHeader('Content-Type', file.contentType)
        res.end(file.source)
      })
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source: file.source })
      }
    },
  }
}
