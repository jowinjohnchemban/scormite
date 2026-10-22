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
 *  - robots.txt, sitemap.xml, llms.txt, llms-full.txt, manifest.webmanifest,
 *    and the published docs — served by the dev server and emitted into the
 *    build
 *
 * What differs per build comes from `SeoBuildContext` (build/seoContext.ts):
 * whether the deployment may be indexed, the content's last-change date, and
 * the docs' text. The sitemap lists the HTML pages the build actually emits.
 */

import path from 'node:path'
import type { Plugin } from 'vite'
import type { SiteSeoConfig } from '../src/shared/config/seo.js'
import type { PublishedDoc, SeoBuildContext } from './seoContext.js'

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
        author: {
          '@type': 'Person',
          name: config.author.name,
          url: config.author.url,
          sameAs: config.author.profiles,
        },
        license: `https://spdx.org/licenses/${config.source.license}.html`,
        isAccessibleForFree: true,
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
  const faqs = config.faqs.map((f) => `<dt>${escapeHtml(f.question)}</dt><dd>${escapeHtml(f.answer)}</dd>`).join('')
  return `<div class="seo-fallback">
      <h1>${escapeHtml(config.headline)}</h1>
      <p>${escapeHtml(config.summary)}</p>
      <noscript><p><strong>SCORMite runs entirely in your browser and needs JavaScript enabled.</strong></p></noscript>
      <h2>What you can do with ${escapeHtml(config.name)}</h2>
      <ul>${features}</ul>
      <h2>Frequently asked questions</h2>
      <dl>${faqs}</dl>
      <p><a href="/about/">About ${escapeHtml(config.name)}</a>: credits, architecture, and open-source licences.</p>
    </div>`
}

export function renderRobotsTxt(origin: string, indexable: boolean): string {
  // A preview or staging deployment must not compete with production.
  if (!indexable) return 'User-agent: *\nDisallow: /\n'
  // /scorm-files/ is the service worker's virtual path for unzipped packages:
  // per-session, never real pages.
  return `User-agent: *\nAllow: /\nDisallow: /scorm-files/\n\nSitemap: ${origin}/sitemap.xml\n`
}

/** Site paths of emitted HTML pages: `index.html` → `/`, `a/index.html` → `/a/`, `b.html` → `/b`. */
export function pagesFromHtmlFiles(fileNames: readonly string[]): string[] {
  return fileNames
    .filter((name) => name.endsWith('.html') && !/(^|\/)404\.html$/.test(name))
    .map((name) =>
      name === 'index.html' || name.endsWith('/index.html')
        ? `/${name.slice(0, -'index.html'.length)}`
        : `/${name.slice(0, -'.html'.length)}`,
    )
    .sort()
}

export function renderSitemapXml(pages: readonly string[], origin: string, lastmod: string): string {
  const urls = pages
    .map((route) => {
      const loc = absoluteUrl(origin, route)
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** A published doc's Markdown with its relative links made absolute, for use outside its folder. */
export function absolutizeLinks(doc: PublishedDoc, origin: string): string {
  return doc.markdown.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (link, text: string, target: string) => {
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return link
    const resolved = target.startsWith('#')
      ? `${doc.path}${target}`
      : path.posix.join(path.posix.dirname(doc.path), target)
    return `[${text}](${absoluteUrl(origin, resolved)})`
  })
}

/** llms.txt per https://llmstxt.org — what the site is, for AI assistants. */
export function renderLlmsTxt(config: SiteSeoConfig, origin: string, docs: readonly PublishedDoc[]): string {
  const features = config.features.map((f) => `- **${f.title}**: ${f.description}`).join('\n')
  const faqs = config.faqs.map((f) => `### ${f.question}\n\n${f.answer}`).join('\n\n')
  const docLinks = docs.map((doc) => `- [${doc.title}](${absoluteUrl(origin, doc.path)}): ${doc.summary}`).join('\n')
  return `# ${config.name}

> ${config.description}

${config.summary}

## App

- [${config.name}](${origin}/): open the app and drop a SCORM .zip to start
- [Source code](${config.source.url}): open source under the ${config.source.license} licence

## Docs

${docLinks}
- [Everything in one file](${origin}/llms-full.txt): this summary and the full text of every document above

## Features

${features}

## FAQ

${faqs}
`
}

/** llms-full.txt — the site summary followed by the full text of every published doc. */
export function renderLlmsFullTxt(config: SiteSeoConfig, origin: string, docs: readonly PublishedDoc[]): string {
  const summary = `# ${config.name}\n\n> ${config.description}\n\n${config.summary}\n`
  const bodies = docs.map(
    (doc) => `Source: ${absoluteUrl(origin, doc.path)}\n\n${absolutizeLinks(doc, origin).trim()}\n`,
  )
  return [summary, ...bodies].join('\n---\n\n')
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

const XML = 'application/xml; charset=utf-8'
const MARKDOWN = 'text/markdown; charset=utf-8'

export function createSeoPlugin(config: SiteSeoConfig, context: SeoBuildContext): Plugin {
  const origin = config.siteUrl.replace(/\/$/, '')
  const ogImage = absoluteUrl(origin, config.ogImage)

  const files: Record<string, { contentType: string; source: string }> = {
    'robots.txt': { contentType: 'text/plain; charset=utf-8', source: renderRobotsTxt(origin, context.indexable) },
    // The dev server has one page; the build lists the pages it emits instead.
    'sitemap.xml': { contentType: XML, source: renderSitemapXml(['/'], origin, context.lastmod) },
    'llms.txt': { contentType: MARKDOWN, source: renderLlmsTxt(config, origin, context.docs) },
    'llms-full.txt': { contentType: MARKDOWN, source: renderLlmsFullTxt(config, origin, context.docs) },
    'manifest.webmanifest': {
      contentType: 'application/manifest+json; charset=utf-8',
      source: renderWebManifest(config),
    },
    ...Object.fromEntries(context.docs.map((doc) => [doc.path, { contentType: MARKDOWN, source: doc.markdown }])),
  }

  const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const })

  return {
    name: 'scormite-seo',
    transformIndexHtml(html, ctx) {
      // The home page takes its title and description from the config; other
      // pages (about/) keep the ones in their HTML and get the shared tags.
      const home = ctx.path === '/index.html'
      const title = home ? config.title : (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? config.title)
      const description = home
        ? config.description
        : (html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? config.description)
      const pageUrl = absoluteUrl(origin, ctx.path.replace(/index\.html$/, ''))
      const updated = home
        ? html
            .replace(/<title>.*<\/title>/, `<title>${escapeHtml(config.title)}</title>`)
            .replace(
              /<meta name="description" content=".*"\s*\/?>/,
              `<meta name="description" content="${escapeHtml(config.description)}" />`,
            )
            .replace('<div id="root"></div>', `<div id="root">${renderStaticContent(config)}</div>`)
        : html

      return {
        html: updated,
        tags: [
          ...(home ? [meta({ name: 'keywords', content: config.keywords.join(', ') })] : []),
          meta({
            name: 'robots',
            content: context.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
          }),
          { tag: 'link', attrs: { rel: 'canonical', href: pageUrl }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
          meta({ name: 'theme-color', content: config.themeColor }),
          meta({ name: 'color-scheme', content: 'dark' }),
          meta({ name: 'application-name', content: config.name }),
          meta({ name: 'apple-mobile-web-app-title', content: config.name }),
          meta({ property: 'og:site_name', content: config.name }),
          meta({ property: 'og:title', content: title }),
          meta({ property: 'og:description', content: description }),
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:url', content: pageUrl }),
          meta({ property: 'og:locale', content: config.locale }),
          meta({ property: 'og:image', content: ogImage }),
          meta({ property: 'og:image:type', content: 'image/png' }),
          meta({ property: 'og:image:width', content: '1200' }),
          meta({ property: 'og:image:height', content: '630' }),
          meta({ property: 'og:image:alt', content: config.ogImageAlt }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
          meta({ name: 'twitter:title', content: title }),
          meta({ name: 'twitter:description', content: description }),
          meta({ name: 'twitter:image', content: ogImage }),
          meta({ name: 'twitter:image:alt', content: config.ogImageAlt }),
          ...(home
            ? [
                {
                  tag: 'script',
                  attrs: { type: 'application/ld+json' },
                  children: inlineJson(renderStructuredData(config, origin)),
                  injectTo: 'head' as const,
                },
              ]
            : []),
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
    generateBundle: {
      // After Vite has emitted the HTML pages, so the sitemap can list them.
      order: 'post',
      handler(_options, bundle) {
        const pages = pagesFromHtmlFiles(Object.keys(bundle))
        const emitted = {
          ...files,
          'sitemap.xml': { contentType: XML, source: renderSitemapXml(pages, origin, context.lastmod) },
        }
        for (const [fileName, file] of Object.entries(emitted)) {
          this.emitFile({ type: 'asset', fileName, source: file.source })
        }
      },
    },
  }
}
