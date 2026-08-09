import { describe, expect, it, beforeEach } from 'vitest'
import {
  countBySeverity,
  normalizePackagePath,
  validateManifest,
  ValidationService,
} from '../services/ValidationService'
import { useValidationStore } from '../state/validationStore'
import type { Manifest, ManifestResource } from '@/shared/types'

function resource(overrides: Partial<ManifestResource> = {}): ManifestResource {
  return {
    identifier: 'res1',
    type: 'webcontent',
    scormType: 'sco',
    href: 'index.html',
    files: ['index.html', 'js/app.js'],
    ...overrides,
  }
}

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    defaultOrganizationIdentifier: 'org1',
    organizations: [
      {
        identifier: 'org1',
        title: 'Org',
        items: [{ identifier: 'item1', title: 'Intro', isvisible: true, children: [] }],
      },
    ],
    resources: [resource()],
    metadata: {},
    ...overrides,
  }
}

beforeEach(() => {
  useValidationStore.getState().reset()
})

describe('normalizePackagePath', () => {
  it('strips ./ prefixes, leading slashes, and backslashes', () => {
    expect(normalizePackagePath('./index.html')).toBe('index.html')
    expect(normalizePackagePath('/index.html')).toBe('index.html')
    expect(normalizePackagePath('js\\app.js')).toBe('js/app.js')
    expect(normalizePackagePath('././a/b')).toBe('a/b')
  })
})

describe('validateManifest', () => {
  it('flags a launch file that is missing from the package', () => {
    const issues = validateManifest(
      manifest({ resources: [resource({ href: 'missing.html' })] }),
      ['index.html'],
    )

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        source: 'manifest',
        ruleId: 'manifest.missing-launch-file',
        location: 'resource res1',
      }),
    )
  })

  it('flags declared resource files that the ZIP does not contain', () => {
    const issues = validateManifest(
      manifest({
        resources: [resource({ files: ['index.html', 'js/missing.js'] })],
      }),
      ['index.html'],
    )

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        ruleId: 'manifest.missing-resource-file',
        message: expect.stringContaining('js/missing.js'),
      }),
    )
  })

  it('flags item references to resources that do not exist, recursively', () => {
    const issues = validateManifest(
      manifest({
        organizations: [
          {
            identifier: 'org1',
            title: 'Org',
            items: [
              {
                identifier: 'item1',
                title: 'Intro',
                isvisible: true,
                children: [
                  {
                    identifier: 'item2',
                    title: 'Nested',
                    isvisible: true,
                    identifierref: 'ghost',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
      ['index.html'],
    )

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        ruleId: 'manifest.broken-item-reference',
        location: 'item item2',
        message: expect.stringContaining('ghost'),
      }),
    )
  })

  it('flags duplicate resource identifiers', () => {
    const issues = validateManifest(
      manifest({
        resources: [
          resource({ identifier: 'dup' }),
          resource({ identifier: 'dup' }),
        ],
      }),
      ['index.html', 'other.html'],
    )

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        ruleId: 'manifest.duplicate-identifier',
      }),
    )
  })

  it('warns when no SCO resource exists', () => {
    const issues = validateManifest(
      manifest({
        resources: [resource({ scormType: 'asset' })],
      }),
      ['index.html'],
    )

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        ruleId: 'manifest.no-sco-resource',
      }),
    )
  })

  it('produces no issues for a clean manifest', () => {
    const issues = validateManifest(manifest(), ['index.html', 'js/app.js'])
    expect(issues).toHaveLength(0)
  })
})

describe('countBySeverity', () => {
  it('counts each severity bucket', () => {
    const issues = validateManifest(
      manifest({ resources: [resource({ href: 'missing.html' })] }),
      ['index.html', 'js/app.js'],
    )
    issues.push({
      id: 'extra',
      severity: 'suggestion',
      source: 'runtime',
      message: 'Consider a Commit before Terminate.',
      ruleId: 'runtime.suggest-commit',
    })

    expect(countBySeverity(issues)).toEqual({ error: 1, warning: 0, suggestion: 1 })
  })
})

describe('ValidationService.validateManifest', () => {
  it('publishes issues to the store, replacing previous ones', () => {
    useValidationStore.getState().addIssue({
      id: 'stale',
      severity: 'error',
      source: 'runtime',
      message: 'Old issue',
      ruleId: 'runtime.old',
    })

    const issues = ValidationService.validateManifest(
      manifest({ resources: [resource({ href: 'missing.html' })] }),
      ['index.html'],
    )

    expect(issues.length).toBeGreaterThan(0)
    const stored = useValidationStore.getState().issues
    expect(stored).toHaveLength(issues.length)
    expect(stored.some((issue) => issue.id === 'stale')).toBe(false)
    expect(useValidationStore.getState().lastRunAt).not.toBeNull()
  })

  it('marks the store as validated even when the package is clean', () => {
    ValidationService.validateManifest(manifest(), ['index.html', 'js/app.js'])

    const state = useValidationStore.getState()
    expect(state.issues).toHaveLength(0)
    expect(state.lastRunAt).not.toBeNull()
  })
})
