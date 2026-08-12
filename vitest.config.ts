import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/tests/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.test-d.{ts,tsx}',
      ],
      // M15 coverage targets (design doc §9). Set with headroom below the
      // measured baseline so CI failures mean a real regression, and raised
      // in later milestones as the suite grows.
      thresholds: {
        statements: 35,
        branches: 20,
        functions: 30,
        lines: 35,
      },
    },
  },
})
