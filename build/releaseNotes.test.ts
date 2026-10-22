import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { releaseNotes } from './releaseNotes.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const CHANGELOG = `# Changelog

Intro.

## [1.1.0] — 2026-11-01

### Fixed

- A thing.

## [1.0.0] — 2026-10-22

First release.

[1.1.0]: https://example.test/1.1.0
[1.0.0]: https://example.test/1.0.0
`

describe('releaseNotes', () => {
  it('returns one version, with or without the v prefix, up to the next version', () => {
    expect(releaseNotes(CHANGELOG, 'v1.1.0')).toBe('### Fixed\n\n- A thing.\n')
  })

  it('stops before the link references', () => {
    expect(releaseNotes(CHANGELOG, '1.0.0')).toBe('First release.\n')
  })

  it('fails for a version the changelog does not describe', () => {
    expect(() => releaseNotes(CHANGELOG, 'v2.0.0')).toThrow(/no "## \[2.0.0\]" section/)
  })

  it('finds the current package version in the real CHANGELOG.md', () => {
    const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }
    expect(releaseNotes(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), version)).toMatch(/\S/)
  })
})
