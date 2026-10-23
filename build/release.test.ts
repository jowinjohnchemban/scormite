import { describe, expect, it } from 'vitest'
import { bumpFor, commitBump, latestStableTag, nextVersion, promoteUnreleased, setPackageVersion } from './release.js'

describe('latestStableTag', () => {
  it('picks the highest vX.Y.Z tag, ignoring pre-releases and other tags', () => {
    expect(latestStableTag(['v1.0.0', 'v1.10.0', 'v1.9.3', 'v2.0.0-rc.1', 'vnext', ''])).toBe('v1.10.0')
    expect(latestStableTag(['v2.0.0-rc.1'])).toBeNull()
    expect(latestStableTag([])).toBeNull()
  })
})

describe('commitBump', () => {
  it('maps Conventional Commits to a semver bump', () => {
    expect(commitBump('feat(webmcp): add tools (#12)')).toBe('minor')
    expect(commitBump('fix: resolve alerts')).toBe('patch')
    expect(commitBump('perf(player): load once')).toBe('patch')
    expect(commitBump('revert: "feat: x"')).toBe('patch')
    expect(commitBump('feat!: drop SCORM 1.1')).toBe('major')
    expect(commitBump('refactor(app): x\n\nBREAKING CHANGE: the API moved')).toBe('major')
    for (const none of ['docs: guide', 'chore(deps): bump', 'ci: release', 'test: more', 'Merge branch x']) {
      expect(commitBump(none)).toBeNull()
    }
  })

  it('takes the largest bump of a set of commits', () => {
    expect(bumpFor(['docs: a', 'fix: b', 'feat: c'])).toBe('minor')
    expect(bumpFor(['fix: b', 'feat!: c'])).toBe('major')
    expect(bumpFor(['docs: a', 'chore: b'])).toBeNull()
  })
})

describe('nextVersion', () => {
  it('raises the right part and resets the ones below', () => {
    expect(nextVersion('1.4.2', 'patch')).toBe('1.4.3')
    expect(nextVersion('1.4.2', 'minor')).toBe('1.5.0')
    expect(nextVersion('1.4.2', 'major')).toBe('2.0.0')
    expect(() => nextVersion('1.0.0-beta.1', 'patch')).toThrow(/plain/)
  })
})

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- A feature.

## [1.0.0] — 2026-10-22

### Added

- Everything.

[1.0.0]: https://example.com/releases/tag/v1.0.0
`

describe('promoteUnreleased', () => {
  it('moves the Unreleased notes under the version, with a link', () => {
    expect(promoteUnreleased(CHANGELOG, '1.1.0', '2026-11-01', 'https://example.com/releases')).toBe(`# Changelog

## [Unreleased]

## [1.1.0] — 2026-11-01

### Added

- A feature.

## [1.0.0] — 2026-10-22

### Added

- Everything.

[1.1.0]: https://example.com/releases/tag/v1.1.0
[1.0.0]: https://example.com/releases/tag/v1.0.0
`)
  })

  it('refuses an empty Unreleased section or a version already released', () => {
    const empty = CHANGELOG.replace('### Added\n\n- A feature.\n\n', '')
    expect(() => promoteUnreleased(empty, '1.1.0', '2026-11-01', 'u')).toThrow(/empty/)
    expect(() => promoteUnreleased(CHANGELOG, '1.0.0', '2026-11-01', 'u')).toThrow(/already/)
    expect(() => promoteUnreleased('# Changelog\n', '1.1.0', '2026-11-01', 'u')).toThrow(/Unreleased/)
  })
})

describe('setPackageVersion', () => {
  it('replaces only the version, keeping the formatting', () => {
    expect(setPackageVersion('{\n  "name": "x",\n  "version": "1.0.0",\n  "a": 1\n}\n', '1.1.0')).toBe(
      '{\n  "name": "x",\n  "version": "1.1.0",\n  "a": 1\n}\n',
    )
    expect(() => setPackageVersion('{ "name": "x" }', '1.1.0')).toThrow(/version/)
  })
})
