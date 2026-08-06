import { defineConfig, mergeConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import viteConfig from './vite.config.ts'

/**
 * Returns a stub `export default "<path>"` for any static asset import so
 * the jsdom test environment doesn't try to parse binary files.
 */
const assetStub: Plugin = {
  name: 'vitest-asset-stub',
  transform(_code, id) {
    if (/\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot)$/.test(id)) {
      return { code: `export default ${JSON.stringify(id)}` }
    }
  },
}

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [assetStub],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/shared/testing/setup.ts'],
      globals: false,
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: ['**/*.config.*', 'e2e/**', 'dist/**'],
      },
    },
  }),
)
