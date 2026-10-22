/**
 * The About page (`about/index.html`, served at /about/): who made SCORMite,
 * which build this is, how it is put together (the live architecture
 * diagram), and the open-source software it ships, with licences.
 *
 * Everything is generated: the licences from the npm packages whose modules
 * are actually in the production bundle (plus Tailwind's CSS), with their full
 * texts in /licenses.txt; the diagram from the source; the build details from
 * the environment. The page cannot drift from the product it describes.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { SiteSeoConfig } from '../src/shared/config/seo.js'
import { analyzeArchitecture, renderArchitectureSvg, themeColors } from './architecture.js'

export const ABOUT_PAGE = '/about/index.html'
const PLACEHOLDER = '<div id="about"></div>'

export interface PackageCredit {
  name: string
  version: string
  license: string
  url: string | null
  licenseText: string | null
}

export interface BuildInfo {
  /** From package.json; null while it is the 0.0.0 placeholder. */
  version: string | null
  commit: string | null
  builtAt: string
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** npm package name → directory, for every bundled module that lives in node_modules. */
export function packageDirsFromModuleIds(moduleIds: Iterable<string>): Map<string, string> {
  const dirs = new Map<string, string>()
  for (const id of moduleIds) {
    const file = id.replace(/^\0/, '').split('?')[0]!.replace(/\\/g, '/')
    const at = file.lastIndexOf('/node_modules/')
    if (at === -1) continue
    const base = at + '/node_modules/'.length
    const parts = file.slice(base).split('/')
    const name = parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!
    if (name && !dirs.has(name)) dirs.set(name, file.slice(0, base) + name)
  }
  return dirs
}

function repositoryUrl(pkg: Record<string, unknown>): string | null {
  const repo = pkg['repository']
  const raw = typeof repo === 'string' ? repo : (repo as { url?: string } | undefined)?.url
  if (typeof pkg['homepage'] === 'string') return pkg['homepage']
  if (!raw) return null
  const url = raw
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
  return url.startsWith('github:') ? `https://github.com/${url.slice(7)}` : /^https?:/.test(url) ? url : null
}

export function readPackageCredit(dir: string): PackageCredit {
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as Record<string, unknown>
  const license = pkg['license']
  const licenseFile = readdirSync(dir).find((file) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(file))
  return {
    name: String(pkg['name']),
    version: String(pkg['version']),
    license:
      typeof license === 'string' ? license : ((license as { type?: string } | undefined)?.type ?? 'See package'),
    url: repositoryUrl(pkg),
    licenseText: licenseFile ? readFileSync(path.join(dir, licenseFile), 'utf8').trim() : null,
  }
}

/** Packages whose code ships to the browser that no JavaScript module reveals (Tailwind's CSS). */
const CSS_PACKAGES = ['tailwindcss']

/** Credits for the packages in a production bundle, sorted by name. */
export function creditsFromBundle(
  bundle: Record<string, { type: string; modules?: Record<string, unknown> }>,
  root: string,
): PackageCredit[] {
  const ids = Object.values(bundle).flatMap((item) => (item.type === 'chunk' ? Object.keys(item.modules ?? {}) : []))
  const dirs = packageDirsFromModuleIds(ids)
  for (const name of CSS_PACKAGES) dirs.set(name, path.join(root, 'node_modules', name))
  return sortCredits(
    [...dirs.values()].filter((dir) => existsSync(path.join(dir, 'package.json'))).map(readPackageCredit),
  )
}

/** The dev server has no bundle: credit the direct dependencies instead. */
export function creditsFromDependencies(root: string): PackageCredit[] {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  return sortCredits(
    Object.keys(pkg.dependencies ?? {})
      .map((name) => path.join(root, 'node_modules', name))
      .filter((dir) => existsSync(path.join(dir, 'package.json')))
      .map(readPackageCredit),
  )
}

const sortCredits = (credits: PackageCredit[]) => credits.sort((a, b) => a.name.localeCompare(b.name))

export function resolveBuildInfo(
  env: Readonly<Record<string, string | undefined>>,
  root: string,
  now = new Date(),
): BuildInfo {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string }
  let commit =
    env['WORKERS_CI_COMMIT_SHA'] ||
    env['CF_PAGES_COMMIT_SHA'] ||
    env['VERCEL_GIT_COMMIT_SHA'] ||
    env['COMMIT_REF'] ||
    env['GITHUB_SHA'] ||
    null
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      commit = null
    }
  }
  return {
    version: pkg.version && pkg.version !== '0.0.0' ? pkg.version : null,
    commit: commit ? commit.slice(0, 7) : null,
    builtAt: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const link = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" class="text-accent underline underline-offset-2 hover:decoration-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">${escapeHtml(label)}</a>`

const heading = (id: string, label: string) =>
  `<h2 id="${id}" class="mb-3 text-sm font-semibold text-slate-200">${escapeHtml(label)}</h2>`

/** A profile link's label: "GitHub" for github.com, otherwise the host name. */
function profileLabel(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '')
  return host === 'github.com' ? 'GitHub' : host
}

export interface AboutContent {
  config: SiteSeoConfig
  build: BuildInfo
  credits: readonly PackageCredit[]
  diagramSvg: string
  /** True on the dev server, where credits are the direct dependencies. */
  preview: boolean
}

export function renderAboutBody({ config, build, credits, diagramSvg, preview }: AboutContent): string {
  const { author } = config
  const runtime = credits.find((credit) => credit.name === 'scorm-again')
  const buildRows: [string, string][] = [
    ...(build.version ? ([['Version', build.version]] as [string, string][]) : []),
    ['Commit', build.commit ?? 'unknown'],
    ['Built', build.builtAt],
    ...(runtime ? ([['SCORM runtime', `scorm-again ${runtime.version}`]] as [string, string][]) : []),
  ]
  const profileLinks = author.profiles.map((url) => link(url, profileLabel(url))).join(' · ')
  const creditRows = credits
    .map(
      (credit) => `<tr class="border-t border-border-subtle">
              <td class="px-3 py-1.5 text-slate-200">${credit.url ? link(credit.url, credit.name) : escapeHtml(credit.name)}</td>
              <td class="px-3 py-1.5 font-mono text-slate-400">${escapeHtml(credit.version)}</td>
              <td class="px-3 py-1.5 text-slate-400">${escapeHtml(credit.license)}</td>
            </tr>`,
    )
    .join('\n            ')

  return `<div class="min-h-full bg-surface-950 text-slate-100">
      <header class="border-b border-border-subtle bg-surface-900">
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
          <a href="/" class="flex items-center gap-2 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
            <img src="/logo-mark-24.svg" width="24" height="24" alt="" />${escapeHtml(config.name)}
          </a>
          <a href="/" class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface-950 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900">Open the app</a>
        </div>
      </header>
      <main class="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8">
        <section>
          <h1 class="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">About ${escapeHtml(config.name)}</h1>
          <p class="mt-3 text-sm text-slate-400">${escapeHtml(config.summary)}</p>
        </section>

        <section aria-labelledby="about-author">
          ${heading('about-author', 'Made by')}
          <p class="text-sm text-slate-300">Designed and developed by ${link(author.url, author.name)}.</p>
          <p class="mt-1 text-xs text-slate-400">${link(author.url, new URL(author.url).hostname)}${profileLinks ? ` · ${profileLinks}` : ''}</p>
        </section>

        <section aria-labelledby="about-build">
          ${heading('about-build', 'This build')}
          <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-xs">
            ${buildRows.map(([term, value]) => `<dt class="text-slate-500">${escapeHtml(term)}</dt><dd class="font-mono text-slate-300">${escapeHtml(value)}</dd>`).join('\n            ')}
          </dl>
        </section>

        <section aria-labelledby="about-architecture">
          ${heading('about-architecture', 'Architecture')}
          <p class="mb-3 text-xs text-slate-400">Drawn from the source code when this build was made: each box is a module, the tags are what it imports, and the counts are its files and lines. Features never import each other; only the runtime feature talks to scorm-again.</p>
          <div tabindex="0" role="region" aria-label="Architecture diagram" class="overflow-x-auto rounded-md border border-border-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:min-w-[720px]">
            ${diagramSvg.trim()}
          </div>
        </section>

        <section aria-labelledby="about-licences">
          ${heading('about-licences', 'Open-source software')}
          <p class="mb-3 text-xs text-slate-400">${
            preview
              ? 'Development server: the direct dependencies. A production build lists exactly the packages it ships.'
              : `${escapeHtml(config.name)} ships with ${credits.length} open-source packages.`
          } Full licence texts: ${link('/licenses.txt', 'licenses.txt')}.</p>
          <div tabindex="0" role="region" aria-label="Open-source packages" class="overflow-x-auto rounded-md border border-border-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent">
            <table class="w-full border-collapse text-left text-xs">
              <thead class="bg-surface-900 text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th class="px-3 py-1.5 font-medium">Package</th><th class="px-3 py-1.5 font-medium">Version</th><th class="px-3 py-1.5 font-medium">Licence</th></tr>
              </thead>
              <tbody>
            ${creditRows}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>`
}

export function renderLicensesTxt(config: SiteSeoConfig, credits: readonly PackageCredit[]): string {
  const header = `${config.name} includes the following open-source software.\n`
  const sections = credits.map((credit) =>
    [
      `${credit.name} ${credit.version} — ${credit.license}`,
      ...(credit.url ? [credit.url] : []),
      '',
      credit.licenseText ?? `No licence file is included in the package; it is published under ${credit.license}.`,
    ].join('\n'),
  )
  return `${[header, ...sections].join(`\n${'-'.repeat(72)}\n\n`)}\n`
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function createAboutPlugin(config: SiteSeoConfig, root: string, build: BuildInfo): Plugin {
  const diagram = () =>
    renderArchitectureSvg(analyzeArchitecture(root), {
      metrics: true,
      colors: themeColors(readFileSync(path.join(root, 'src', 'index.css'), 'utf8')),
    })

  return {
    name: 'scormite-about',
    transformIndexHtml(html, ctx) {
      if (ctx.path !== ABOUT_PAGE) return html
      const bundle = ctx.bundle as Parameters<typeof creditsFromBundle>[0] | undefined
      const credits = bundle ? creditsFromBundle(bundle, root) : creditsFromDependencies(root)
      const body = renderAboutBody({ config, build, credits, diagramSvg: diagram(), preview: !bundle })
      return html.replace(PLACEHOLDER, body)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/licenses.txt') return next()
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(renderLicensesTxt(config, creditsFromDependencies(root)))
      })
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const credits = creditsFromBundle(bundle as Parameters<typeof creditsFromBundle>[0], root)
        this.emitFile({ type: 'asset', fileName: 'licenses.txt', source: renderLicensesTxt(config, credits) })
      },
    },
  }
}
