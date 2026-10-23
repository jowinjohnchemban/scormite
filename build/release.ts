/**
 * Prepares a release: the next version from the Conventional Commits since
 * the last `v*` tag (a breaking change → major, feat → minor, fix/perf/revert
 * → patch), written to package.json, with CHANGELOG.md's Unreleased notes
 * moved under that version. Merging the result to main publishes the release
 * (see .github/workflows/release.yml).
 *
 * Node built-ins only:
 *   node build/release.ts             # bump from the commits
 *   node build/release.ts minor       # or force major | minor | patch
 *   node build/release.ts --dry-run   # print the next version, change nothing
 * Prints the new version on stdout; explanations go to stderr.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type Bump = 'major' | 'minor' | 'patch'

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 }

/** The bump one commit message asks for, or null for one that ships nothing (docs, chore, ci, …). */
export function commitBump(message: string): Bump | null {
  const [subject = '', ...body] = message.split(/\r?\n/)
  const header = /^(\w+)(\([^)]*\))?(!)?:\s/.exec(subject)
  if (header?.[3] || body.some((line) => /^BREAKING[ -]CHANGE:/.test(line))) return 'major'
  switch (header?.[1]) {
    case 'feat':
      return 'minor'
    case 'fix':
    case 'perf':
    case 'revert':
      return 'patch'
    default:
      return null
  }
}

/** The largest bump the commits ask for, or null when none ships anything. */
export function bumpFor(messages: readonly string[]): Bump | null {
  let bump: Bump | null = null
  for (const message of messages) {
    const next = commitBump(message)
    if (next && (!bump || RANK[next] > RANK[bump])) bump = next
  }
  return bump
}

/** `version` raised by `bump` (semver, without pre-release parts). */
export function nextVersion(version: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`"${version}" is not a plain x.y.z version`)
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number]
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/**
 * CHANGELOG.md with its Unreleased notes moved under `## [version] — date`,
 * a fresh empty Unreleased section above it, and a link to the release.
 */
export function promoteUnreleased(changelog: string, version: string, date: string, releasesUrl: string): string {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => /^## \[Unreleased\]/i.test(line))
  if (start === -1) throw new Error('CHANGELOG.md has no "## [Unreleased]" section')
  if (lines.some((line) => line.startsWith(`## [${version}]`))) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`)
  }
  const end = lines.findIndex((line, i) => i > start && /^## |^\[[^\]]+\]:\s/.test(line))
  const notes = lines.slice(start + 1, end === -1 ? undefined : end)
  if (!notes.join('').trim()) throw new Error('The Unreleased section of CHANGELOG.md is empty: nothing to release')

  const promoted = [...lines.slice(0, start), '## [Unreleased]', '', `## [${version}] — ${date}`, ...notes]
  const rest = end === -1 ? [] : lines.slice(end)
  const link = `[${version}]: ${releasesUrl}/tag/v${version}`
  const firstLink = rest.findIndex((line) => /^\[[^\]]+\]:\s/.test(line))
  if (firstLink === -1) {
    while (promoted.at(-1) === '') promoted.pop()
    return `${[...promoted, ...rest].join('\n').trimEnd()}\n\n${link}\n`
  }
  rest.splice(firstLink, 0, link)
  return [...promoted, ...rest].join('\n')
}

/** package.json text with its version replaced, formatting untouched. */
export function setPackageVersion(packageJson: string, version: string): string {
  const updated = packageJson.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`)
  if (updated === packageJson && !packageJson.includes(`"version": "${version}"`)) {
    throw new Error('package.json has no "version" field')
  }
  return updated
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const forced = args.find((arg) => arg === 'major' || arg === 'minor' || arg === 'patch') as Bump | undefined

  const packagePath = path.join(root, 'package.json')
  const packageJson = readFileSync(packagePath, 'utf8')
  const pkg = JSON.parse(packageJson) as { version: string; repository?: { url?: string } }

  let lastTag = ''
  try {
    lastTag = git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], root)
  } catch {
    // No release yet: every commit counts.
  }
  const range = lastTag ? [`${lastTag}..HEAD`] : ['HEAD']
  const messages = git(['log', ...range, '--format=%B%x1e'], root)
    .split('\x1e')
    .map((message) => message.trim())
    .filter(Boolean)

  const bump = forced ?? bumpFor(messages)
  if (!bump) {
    console.error(`No feat, fix, perf, revert, or breaking commit since ${lastTag || 'the start'}: nothing to release.`)
    process.exit(1)
  }
  const version = nextVersion(pkg.version, bump)
  console.error(
    `${pkg.version} → ${version} (${bump}${forced ? ', forced' : ''}; ${messages.length} commit(s) since ${lastTag || 'the start'})`,
  )

  if (!dryRun) {
    const repository = (pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '')
    const changelogPath = path.join(root, 'CHANGELOG.md')
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(
      changelogPath,
      promoteUnreleased(readFileSync(changelogPath, 'utf8'), version, date, `${repository}/releases`),
    )
    writeFileSync(packagePath, setPackageVersion(packageJson, version))
  }
  process.stdout.write(`${version}\n`)
}
