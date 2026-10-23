/**
 * A dependency report for the scheduled update check: packages with newer
 * releases (`pnpm outdated`) and known vulnerabilities (`pnpm audit`), as
 * the Markdown body of the issue the workflow keeps up to date.
 *
 * Node built-ins only:
 *   node build/dependencyReport.ts report.md
 * writes the report and prints the number of findings (0: nothing to do).
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface OutdatedEntry {
  current: string
  latest: string
  wanted?: string
  isDeprecated?: boolean
  dependencyType?: string
}

export interface AuditAdvisory {
  module_name: string
  severity: string
  title: string
  url?: string
  vulnerable_versions?: string
  patched_versions?: string
}

export interface AuditResult {
  advisories?: Record<string, AuditAdvisory>
}

export interface DependencyReport {
  findings: number
  markdown: string
}

/** Which part of the version a move from `current` to `latest` changes. */
export function updateType(current: string, latest: string): 'major' | 'minor' | 'patch' | 'other' {
  const parse = (version: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(version)?.slice(1).map(Number)
  const from = parse(current)
  const to = parse(latest)
  if (!from || !to) return 'other'
  if (to[0] !== from[0]) return 'major'
  if (to[1] !== from[1]) return 'minor'
  return to[2] !== from[2] ? 'patch' : 'other'
}

/** Major updates held back on purpose (as in .github/dependabot.yml), with why. */
export const HELD_BACK: Record<string, string> = {
  '@types/node': 'tracks the Node version CI and the container run (24); bump it with them',
  typescript:
    'typescript-eslint supports TypeScript below 6.1, and TypeScript 7 (the native compiler) has no stable API for it yet; upgrade once typescript-eslint supports 7',
}

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info']
const UPDATE_ORDER = ['major', 'minor', 'patch', 'other']

export function dependencyReport(
  outdated: Record<string, OutdatedEntry>,
  audit: AuditResult,
  date: string,
): DependencyReport {
  const all = Object.entries(outdated)
    .map(([name, entry]) => ({ name, ...entry, update: updateType(entry.current, entry.latest) }))
    .sort((a, b) => UPDATE_ORDER.indexOf(a.update) - UPDATE_ORDER.indexOf(b.update) || a.name.localeCompare(b.name))
  const isHeld = (p: (typeof all)[number]) => p.update === 'major' && HELD_BACK[p.name] !== undefined
  const packages = all.filter((p) => !isHeld(p))
  const held = all.filter(isHeld)
  const advisories = Object.values(audit.advisories ?? {}).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )

  const lines = [`Checked on ${date} by the daily dependency check.`, '']
  if (advisories.length) {
    lines.push(
      '## Vulnerabilities',
      '',
      '| Package | Severity | Advisory | Affected | Fixed in |',
      '| --- | --- | --- | --- | --- |',
      ...advisories.map(
        (a) =>
          `| \`${a.module_name}\` | ${a.severity} | ${a.url ? `[${a.title}](${a.url})` : a.title} | ${a.vulnerable_versions ?? ''} | ${a.patched_versions ?? ''} |`,
      ),
      '',
    )
  }
  if (packages.length) {
    lines.push(
      '## Newer releases',
      '',
      '| Package | Kind | Current | Latest | Update |',
      '| --- | --- | --- | --- | --- |',
      ...packages.map(
        (p) =>
          `| \`${p.name}\`${p.isDeprecated ? ' (deprecated)' : ''} | ${p.dependencyType === 'devDependencies' ? 'dev' : 'runtime'} | ${p.current} | ${p.latest} | ${p.update} |`,
      ),
      '',
    )
  }
  if (held.length) {
    lines.push(
      '## Held back on purpose',
      '',
      ...held.map((p) => `- \`${p.name}\` ${p.current} → ${p.latest}: ${HELD_BACK[p.name] ?? ''}.`),
      '',
    )
  }
  lines.push(
    '## What to do',
    '',
    '- Dependabot opens pull requests for minor and patch releases every Monday, and for security fixes as soon as they are published; review and merge those.',
    '- Major releases need a manual upgrade: read the release notes, then update in a pull request (`pnpm add <package>@latest`), with CI green.',
    '- This issue updates itself each day and closes when everything is current.',
  )
  return { findings: packages.length + advisories.length, markdown: `${lines.join('\n')}\n` }
}

/** Parse a pnpm JSON report; null when the output is not one (pnpm failed before reporting). */
export function parseReport(output: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(output)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * Run pnpm and parse its JSON report. pnpm exits non-zero when it has
 * findings and still prints the report; a failure without a report (no
 * network, a broken install) is rethrown, so the check fails instead of
 * reading as "nothing to update".
 */
function pnpmJson(args: string[], cwd: string): Record<string, unknown> {
  const options = { cwd, encoding: 'utf8' as const, shell: process.platform === 'win32' }
  let output: string
  try {
    output = execFileSync('pnpm', args, options)
  } catch (error) {
    const report = parseReport(String((error as { stdout?: unknown }).stdout ?? ''))
    if (report) return report
    throw error
  }
  const report = output.trim() === '' ? {} : parseReport(output)
  if (!report) throw new Error(`pnpm ${args.join(' ')} did not print a JSON report`)
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const out = process.argv[2]
  if (!out) throw new Error('Usage: node build/dependencyReport.ts <report.md>')
  const report = dependencyReport(
    pnpmJson(['outdated', '--format', 'json'], root) as Record<string, OutdatedEntry>,
    pnpmJson(['audit', '--json'], root) as AuditResult,
    new Date().toISOString().slice(0, 10),
  )
  writeFileSync(out, report.markdown)
  process.stdout.write(`${report.findings}\n`)
}
