/**
 * The About page and licences file: which packages are credited, what the
 * build details say, and that every value is escaped.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { siteSeoConfig } from '../src/shared/config/seo.js'
import {
  creditsFromBundle,
  packageDirsFromModuleIds,
  readPackageCredit,
  renderAboutBody,
  renderLicensesTxt,
  resolveBuildInfo,
  type PackageCredit,
} from './aboutPage.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const CREDIT: PackageCredit = {
  name: 'scorm-again',
  version: '3.4.6',
  license: 'MIT',
  url: 'https://github.com/jcputney/scorm-again',
  licenseText: 'MIT License\n\nCopyright (c) Example',
}

describe('packageDirsFromModuleIds', () => {
  it('finds the npm package of every bundled module, scoped or not, through pnpm paths', () => {
    const dirs = packageDirsFromModuleIds([
      '/repo/src/main.tsx',
      '/repo/node_modules/.pnpm/react@19/node_modules/react/index.js',
      '/repo/node_modules/.pnpm/react@19/node_modules/react/cjs/react.production.js?commonjs-exports',
      '\0/repo/node_modules/@scope/pkg/dist/x.js',
      'C:\\repo\\node_modules\\zustand\\esm\\index.mjs',
      '\0vite/preload-helper',
    ])
    expect([...dirs]).toEqual([
      ['react', '/repo/node_modules/.pnpm/react@19/node_modules/react'],
      ['@scope/pkg', '/repo/node_modules/@scope/pkg'],
      ['zustand', 'C:/repo/node_modules/zustand'],
    ])
  })
})

describe('readPackageCredit', () => {
  it('reads the version, licence, home page, and licence text of an installed package', () => {
    const credit = readPackageCredit(path.join(root, 'node_modules', 'scorm-again'))
    expect(credit.name).toBe('scorm-again')
    expect(credit.license).toBe('MIT')
    expect(credit.url).toMatch(/^https:\/\//)
    expect(credit.licenseText).toMatch(/MIT/)
  })
})

describe('creditsFromBundle', () => {
  it('credits the packages in the chunks plus Tailwind, whose CSS ships without a JavaScript module', () => {
    const scormAgain = path.join(root, 'node_modules', 'scorm-again', 'dist', 'scorm12.js').replace(/\\/g, '/')
    const credits = creditsFromBundle(
      {
        'assets/index.js': { type: 'chunk', modules: { [scormAgain]: {}, '/repo/src/main.tsx': {} } },
        'assets/index.css': { type: 'asset' },
      },
      root,
    )
    expect(credits.map((c) => c.name)).toEqual(['scorm-again', 'tailwindcss'])
  })
})

describe('resolveBuildInfo', () => {
  const now = new Date('2026-10-22T09:30:00Z')

  it('takes the version from package.json and the commit from the host', () => {
    const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }
    const info = resolveBuildInfo({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567' }, root, now)
    expect(info).toEqual({ version, commit: 'abcdef1', builtAt: '2026-10-22 09:30 UTC' })
  })

  it('falls back to git for the commit', () => {
    expect(resolveBuildInfo({}, root, now).commit).toMatch(/^[0-9a-f]{7}$/)
  })
})

describe('renderAboutBody', () => {
  const body = renderAboutBody({
    config: siteSeoConfig,
    build: { version: '1.2.0', commit: 'abcdef1', builtAt: '2026-10-22 09:30 UTC' },
    credits: [CREDIT, { ...CREDIT, name: 'x<y>', url: null }],
    diagramSvg: '<svg role="img"></svg>',
    preview: false,
  })

  it('credits the developer with links to their site and profiles', () => {
    expect(body).toContain(`Designed and developed by <a href="${siteSeoConfig.author.url}"`)
    expect(body).toContain(`>${siteSeoConfig.author.name}</a>`)
    expect(body).toContain('>GitHub</a>')
  })

  it('shows the build, the runtime version, the diagram, and every package (escaped)', () => {
    expect(body).toContain('>1.2.0</dd>')
    expect(body).toContain('>abcdef1</dd>')
    expect(body).toContain('>scorm-again 3.4.6</dd>')
    expect(body).toContain('<svg role="img"></svg>')
    expect(body).toContain('ships with 2 open-source packages')
    expect(body).toContain('x&lt;y&gt;')
    expect(body).not.toContain('x<y>')
  })
})

describe('renderLicensesTxt', () => {
  it('includes each package with its licence text, or says it has none', () => {
    const txt = renderLicensesTxt(siteSeoConfig, [CREDIT, { ...CREDIT, name: 'bare', licenseText: null }])
    expect(txt).toContain('scorm-again 3.4.6 — MIT\nhttps://github.com/jcputney/scorm-again\n\nMIT License')
    expect(txt).toContain('No licence file is included in the package; it is published under MIT.')
  })
})
