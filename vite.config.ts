import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSeoConfig } from './src/shared/config/seo.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createSeoPlugin(config: typeof siteSeoConfig): Plugin {
  const canonicalUrl = config.siteUrl.replace(/\/$/, '')
  const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${canonicalUrl}/sitemap.xml\nHost: ${canonicalUrl}\n`
  const llmsTxt = config.llms.join('\n') + '\n'
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${config.routes
    .map((route: string) => {
      const path = route.startsWith('/') ? route : `/${route}`
      return `  <url>\n    <loc>${canonicalUrl}${path}</loc>\n  </url>`
    })
    .join('\n')}\n</urlset>\n`

  return {
    name: 'scormite-seo-static',
    transformIndexHtml(html) {
      const description = escapeHtml(config.description)
      const title = escapeHtml(config.title)
      const favicon = escapeHtml(config.favicon)
      const twitterSite = escapeHtml(config.twitterSite)
      const twitterCreator = escapeHtml(config.twitterCreator)
      const locale = escapeHtml(config.locale)
      const themeColor = escapeHtml(config.themeColor)
      const canonicalHref = escapeHtml(canonicalUrl + '/')

      const updatedHtml = html
        .replace(/<title>.*<\/title>/, `<title>${title}</title>`)
        .replace(
          /<meta name="description" content=".*"\s*\/?>/,
          `<meta name="description" content="${description}" />`,
        )

      return {
        html: updatedHtml,
        tags: [
          { tag: 'link', attrs: { rel: 'canonical', href: canonicalHref } },
          { tag: 'meta', attrs: { name: 'theme-color', content: themeColor } },
          { tag: 'meta', attrs: { property: 'og:title', content: title } },
          { tag: 'meta', attrs: { property: 'og:description', content: description } },
          { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
          { tag: 'meta', attrs: { property: 'og:url', content: canonicalHref } },
          { tag: 'meta', attrs: { property: 'og:locale', content: locale } },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
          { tag: 'meta', attrs: { name: 'twitter:site', content: twitterSite } },
          { tag: 'meta', attrs: { name: 'twitter:creator', content: twitterCreator } },
          { tag: 'meta', attrs: { name: 'twitter:title', content: title } },
          { tag: 'meta', attrs: { name: 'twitter:description', content: description } },
          { tag: 'meta', attrs: { name: 'twitter:image', content: favicon } },
        ],
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          return next()
        }

        if (req.url === '/robots.txt') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(robotsTxt)
          return
        }

        if (req.url === '/sitemap.xml') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/xml; charset=utf-8')
          res.end(sitemapXml)
          return
        }

        if (req.url === '/llms.txt') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(llmsTxt)
          return
        }

        next()
      })
    },
    generateBundle() {
      // Emit static SEO assets into the build output
      const assets: Record<string, { source: string }> = {
        'robots.txt': { source: robotsTxt },
        'sitemap.xml': { source: sitemapXml },
        'llms.txt': { source: llmsTxt },
      }

      for (const [fileName, asset] of Object.entries(assets)) {
        this.emitFile({ type: 'asset', fileName, source: asset.source })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || env.SITE_URL || siteSeoConfig.siteUrl
  const config = {
    ...siteSeoConfig,
    siteUrl,
  }

  return {
    plugins: [react(), tailwindcss(), createSeoPlugin(config)],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
  }
})
