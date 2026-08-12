/**
 * Unit tests for the static manifest validators + helpers.
 * These are pure by construction — manifest in, findings out.
 */

import { describe, expect, it } from 'vitest'
import {
  brokenItemReferenceValidator,
  countBySeverity,
  duplicateResourceIdentifierValidator,
  missingLaunchFileValidator,
  missingResourceFileValidator,
  noScoResourceValidator,
  normalizePackagePath,
  validateManifest,
} from '../services/ValidationService'
import type { Manifest, ValidationIssue } from '@/shared/types'

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    defaultOrganizationIdentifier: 'org-1',
    organizations: [
      {
        identifier: 'org-1',
        title: 'Org',
        items: [
          {
            identifier: 'item-1',
            title: 'Lesson 1',
            identifierref: 'res-1',
            isvisible: true,
            children: [],
          },
        ],
      },
    ],
    resources: [
      {
        identifier: 'res-1',
        type: 'webcontent',
        href: 'index.html',
        scormType: 'sco',
        files: ['index.html', 'course/main.js'],
      },
    ],
    metadata: { schema: 'ADL SCORM', schemaVersion: '1.2' },
    ...overrides,
  }
}

describe('normalizePackagePath', () => {
  it('converts backslashes and strips leading slashes and ./ prefixes', () => {
    expect(normalizePackagePath('res\\scormdriver\\index.html')).toBe('res/scormdriver/index.html')
    expect(normalizePackagePath('./index.html')).toBe('index.html')
    expect(normalizePackagePath('/index.html')).toBe('index.html')
    expect(normalizePackagePath('index.html')).toBe('index.html')
  })
})

describe('missingLaunchFileValidator', () => {
  it('flags a launch file that is not in the package', () => {
    const findings = missingLaunchFileValidator.check({
      manifest: makeManifest(),
      filePaths: ['course/main.js'],
    })
    expect(missingLaunchFileValidator.ruleId).toBe('manifest.missing-launch-file')
    expect(missingLaunchFileValidator.severity).toBe('error')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      location: 'resource res-1',
      message: 'Launch file "index.html" is not present in the package.',
    })
  })

  it('passes when the launch file exists (paths are pre-normalized)', () => {
    const findings = missingLaunchFileValidator.check({
      manifest: makeManifest(),
      filePaths: ['index.html', 'course/main.js'],
    })
    expect(findings).toEqual([])
  })

  it('ignores resources without a launch href', () => {
    const manifest = makeManifest({
      resources: [{ identifier: 'res-1', type: 'asset', files: ['img.png'] }],
    })
    expect(missingLaunchFileValidator.check({ manifest, filePaths: [] })).toEqual([])
  })
})

describe('missingResourceFileValidator', () => {
  it('flags declared files missing from the package', () => {
    const findings = missingResourceFileValidator.check({
      manifest: makeManifest({ resources: [
        { identifier: 'res-1', type: 'webcontent', href: 'index.html', scormType: 'sco', files: ['index.html', 'missing.js'] },
      ] }),
      filePaths: ['index.html'],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.message).toContain('missing.js')
  })

  it('passes when all declared files are present', () => {
    expect(
      missingResourceFileValidator.check({
        manifest: makeManifest(),
        filePaths: ['index.html', 'course/main.js'],
      }),
    ).toEqual([])
  })
})

describe('brokenItemReferenceValidator', () => {
  it('flags an item whose identifierref matches no resource', () => {
    const manifest = makeManifest({
      organizations: [
        {
          identifier: 'org-1',
          title: 'Org',
          items: [
            { identifier: 'item-1', title: 'L', identifierref: 'ghost-res', isvisible: true, children: [] },
          ],
        },
      ],
    })
    const findings = brokenItemReferenceValidator.check({ manifest, filePaths: [] })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.location).toBe('item item-1')
  })

  it('walks nested items recursively', () => {
    const manifest = makeManifest({
      organizations: [
        {
          identifier: 'org-1',
          title: 'Org',
          items: [
            {
              identifier: 'item-1',
              title: 'Parent',
              isvisible: true,
              children: [
                { identifier: 'item-2', title: 'Child', identifierref: 'nope', isvisible: true, children: [] },
              ],
            },
          ],
        },
      ],
    })
    expect(brokenItemReferenceValidator.check({ manifest, filePaths: [] })).toHaveLength(1)
  })

  it('passes when references resolve and ignores items without identifierref', () => {
    const manifest = makeManifest()
    expect(brokenItemReferenceValidator.check({ manifest, filePaths: [] })).toEqual([])
  })
})

describe('duplicateResourceIdentifierValidator', () => {
  it('flags duplicate resource identifiers', () => {
    const manifest = makeManifest({
      resources: [
        { identifier: 'res-1', type: 'webcontent', href: 'a.html', scormType: 'sco', files: [] },
        { identifier: 'res-1', type: 'webcontent', href: 'b.html', scormType: 'sco', files: [] },
      ],
    })
    const findings = duplicateResourceIdentifierValidator.check({ manifest, filePaths: [] })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.message).toContain('res-1')
  })

  it('passes for unique identifiers', () => {
    expect(
      duplicateResourceIdentifierValidator.check({ manifest: makeManifest(), filePaths: [] }),
    ).toEqual([])
  })
})

describe('noScoResourceValidator', () => {
  it('warns when the package has no SCO resources', () => {
    const manifest = makeManifest({
      resources: [{ identifier: 'res-1', type: 'asset', files: ['img.png'] }],
    })
    const findings = noScoResourceValidator.check({ manifest, filePaths: [] })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.message).toContain('No SCO resources')
  })

  it('passes when at least one SCO exists', () => {
    expect(noScoResourceValidator.check({ manifest: makeManifest(), filePaths: [] })).toEqual([])
  })
})

describe('validateManifest', () => {
  it('collects issues across all validators with stable metadata', () => {
    const issues = validateManifest(makeManifest(), [])
    expect(issues.length).toBeGreaterThan(0)
    for (const issue of issues) {
      expect(issue.id).toMatch(/[0-9a-f-]{36}/)
      expect(issue.source).toBe('manifest')
      expect(['error', 'warning', 'suggestion']).toContain(issue.severity)
    }
  })

  it('returns no issues for a fully valid package', () => {
    const issues = validateManifest(
      makeManifest(),
      ['index.html', 'course/main.js'],
    )
    expect(issues).toEqual([])
  })
})

describe('countBySeverity', () => {
  it('counts issues by severity', () => {
    const issues: ValidationIssue[] = [
      { id: '1', severity: 'error', source: 'manifest', message: 'a', ruleId: 'r' },
      { id: '2', severity: 'error', source: 'manifest', message: 'b', ruleId: 'r' },
      { id: '3', severity: 'warning', source: 'manifest', message: 'c', ruleId: 'r' },
    ]
    expect(countBySeverity(issues)).toEqual({ error: 2, warning: 1, suggestion: 0 })
  })

  it('returns zeroed counts for no issues', () => {
    expect(countBySeverity([])).toEqual({ error: 0, warning: 0, suggestion: 0 })
  })
})
