import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSeoConfig } from './src/shared/config/seo.js'
import { createSeoPlugin } from './build/seoPlugin.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The canonical origin for canonical/OG URLs, sitemap, and llms.txt; set
  // VITE_SITE_URL per deployment (preview, staging) to keep them correct.
  const siteUrl = env.VITE_SITE_URL || env.SITE_URL || siteSeoConfig.siteUrl

  return {
    plugins: [react(), tailwindcss(), createSeoPlugin({ ...siteSeoConfig, siteUrl })],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
  }
})
