import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSeoConfig } from './src/shared/config/seo.js'
import { createSeoPlugin } from './build/seoPlugin.js'
import { lastChangeDate, readPublishedDocs, resolveIndexing } from './build/seoContext.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The canonical origin for canonical/OG URLs, sitemap, and llms.txt; set
  // VITE_SITE_URL per deployment (preview, staging) to keep them correct.
  const siteUrl = env.VITE_SITE_URL || env.SITE_URL || siteSeoConfig.siteUrl
  const seoContext = {
    indexable: resolveIndexing(env),
    // When the page's content last changed; the build date without git history.
    lastmod: lastChangeDate(dirname, ['index.html', 'src', 'public']) ?? new Date().toISOString().slice(0, 10),
    docs: readPublishedDocs(dirname, siteSeoConfig.docs),
  }

  return {
    plugins: [react(), tailwindcss(), createSeoPlugin({ ...siteSeoConfig, siteUrl }, seoContext)],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                // The SCORM runtime, unzip, and XML parser are only needed once a
                // package is opened. Their own chunk keeps them out of the start
                // page; without it the bundler merges them into a chunk the start
                // page imports.
                name: 'package-runtime',
                test: /node_modules[/\\](scorm-again|jszip|fast-xml-parser|pako|lie|immediate|setimmediate|readable-stream)[/\\]/,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
  }
})
