/**
 * Release notes for a version, taken from its section of CHANGELOG.md (Keep a
 * Changelog format). The release workflow publishes them, so a tag without a
 * changelog entry fails instead of shipping empty notes.
 *
 * Node built-ins only: `node build/releaseNotes.ts v1.2.3` prints the notes.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** The body of `## [version]` in a changelog, without its heading or link references. */
export function releaseNotes(changelog: string, version: string): string {
  const wanted = version.replace(/^v/, '')
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith(`## [${wanted}]`))
  if (start === -1) throw new Error(`CHANGELOG.md has no "## [${wanted}]" section`)
  const end = lines.findIndex((line, i) => i > start && /^## |^\[[^\]]+\]:\s/.test(line))
  const body = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
  if (!body) throw new Error(`The CHANGELOG.md section for ${wanted} is empty`)
  return `${body}\n`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]
  if (!version) throw new Error('Usage: node build/releaseNotes.ts <version>')
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  process.stdout.write(releaseNotes(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), version))
}
