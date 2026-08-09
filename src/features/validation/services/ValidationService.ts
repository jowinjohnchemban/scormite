import { useValidationStore } from '../state/validationStore'
import type { Manifest, ManifestItem, ValidationIssue, ValidationSeverity } from '@/shared/types'

/** Context available to static (manifest) validators. */
export interface ManifestValidationContext {
  manifest: Manifest
  /** All file paths found in the package ZIP, forward-slash normalized. */
  filePaths: string[]
}

/** One finding from a static validator — a location plus an explanation. */
export interface StaticFinding {
  /** Manifest path or file path the finding points at, when applicable. */
  location?: string
  message: string
}

/**
 * One static validation rule. Pure by construction: given the manifest and
 * the package's real file list, it returns a finding per violation (empty
 * when the rule is satisfied).
 */
export interface StaticValidator {
  ruleId: string
  severity: ValidationSeverity
  check(ctx: ManifestValidationContext): StaticFinding[]
}

/** Normalize a manifest path to the ZIP's forward-slash form. */
export function normalizePackagePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
}

function* walkItems(items: ManifestItem[]): Generator<ManifestItem> {
  for (const item of items) {
    yield item
    yield* walkItems(item.children)
  }
}

/** A resource whose launch file is declared but not present in the package. */
export const missingLaunchFileValidator: StaticValidator = {
  ruleId: 'manifest.missing-launch-file',
  severity: 'error',
  check({ manifest, filePaths }) {
    const present = new Set(filePaths)
    const findings: StaticFinding[] = []
    for (const resource of manifest.resources) {
      if (resource.href === undefined) continue
      const href = normalizePackagePath(resource.href)
      if (!present.has(href)) {
        findings.push({
          location: `resource ${resource.identifier}`,
          message: `Launch file "${resource.href}" is not present in the package.`,
        })
      }
    }
    return findings
  },
}

/** A file the manifest declares inside a resource but the ZIP does not contain. */
export const missingResourceFileValidator: StaticValidator = {
  ruleId: 'manifest.missing-resource-file',
  severity: 'error',
  check({ manifest, filePaths }) {
    const present = new Set(filePaths)
    const findings: StaticFinding[] = []
    for (const resource of manifest.resources) {
      for (const file of resource.files) {
        const normalized = normalizePackagePath(file)
        if (!present.has(normalized)) {
          findings.push({
            location: `resource ${resource.identifier}`,
            message: `Declared file "${file}" is missing from the package.`,
          })
        }
      }
    }
    return findings
  },
}

/** An organization item whose identifierref points at a resource that does not exist. */
export const brokenItemReferenceValidator: StaticValidator = {
  ruleId: 'manifest.broken-item-reference',
  severity: 'error',
  check({ manifest }) {
    const resourceIds = new Set(manifest.resources.map((r) => r.identifier))
    const findings: StaticFinding[] = []
    for (const organization of manifest.organizations) {
      for (const item of walkItems(organization.items)) {
        if (
          item.identifierref !== undefined &&
          !resourceIds.has(item.identifierref)
        ) {
          findings.push({
            location: `item ${item.identifier}`,
            message: `Item references resource "${item.identifierref}" which does not exist.`,
          })
        }
      }
    }
    return findings
  },
}

/** Two resources claiming the same identifier — ambiguous for item references. */
export const duplicateResourceIdentifierValidator: StaticValidator = {
  ruleId: 'manifest.duplicate-identifier',
  severity: 'warning',
  check({ manifest }) {
    const seen = new Map<string, string[]>()
    for (const resource of manifest.resources) {
      const owners = seen.get(resource.identifier) ?? []
      owners.push(resource.identifier)
      seen.set(resource.identifier, owners)
    }
    const findings: StaticFinding[] = []
    for (const [identifier] of seen) {
      if ((seen.get(identifier)?.length ?? 0) > 1) {
        findings.push({
          location: `resource ${identifier}`,
          message: `Duplicate resource identifier "${identifier}".`,
        })
      }
    }
    return findings
  },
}

/** A package with no SCO resource may not launch as an interactive course. */
export const noScoResourceValidator: StaticValidator = {
  ruleId: 'manifest.no-sco-resource',
  severity: 'warning',
  check({ manifest }) {
    if (manifest.resources.some((r) => r.scormType === 'sco')) return []
    return [
      {
        message:
          'No SCO resources found — the course may not launch as an interactive SCO.',
      },
    ]
  },
}

/** The full static rule set, run in this order by `validateManifest`. */
export const STATIC_VALIDATORS: readonly StaticValidator[] = [
  missingLaunchFileValidator,
  missingResourceFileValidator,
  brokenItemReferenceValidator,
  duplicateResourceIdentifierValidator,
  noScoResourceValidator,
]

/** Pure entry point: run every static validator and collect the issues. */
export function validateManifest(
  manifest: Manifest,
  filePaths: string[],
): ValidationIssue[] {
  const ctx: ManifestValidationContext = { manifest, filePaths }
  const issues: ValidationIssue[] = []
  for (const validator of STATIC_VALIDATORS) {
    for (const finding of validator.check(ctx)) {
      issues.push({
        id: crypto.randomUUID(),
        severity: validator.severity,
        source: 'manifest',
        message: finding.message,
        ...(finding.location !== undefined ? { location: finding.location } : {}),
        ruleId: validator.ruleId,
      })
    }
  }
  return issues
}

/** Issue counts by severity, for panel summaries. */
export function countBySeverity(
  issues: readonly ValidationIssue[],
): Record<ValidationSeverity, number> {
  const counts: Record<ValidationSeverity, number> = {
    error: 0,
    warning: 0,
    suggestion: 0,
  }
  for (const issue of issues) {
    counts[issue.severity] += 1
  }
  return counts
}

/**
 * Facade over the validation store — components and the app layer talk to
 * this, not the store directly.
 */
export const ValidationService = {
  /**
   * Run static validation against a loaded package and publish the issues.
   * Replaces any previous issues (a fresh package starts a fresh report);
   * `addIssues([])` still stamps `lastRunAt` so the panel can show "clean".
   */
  validateManifest(manifest: Manifest, filePaths: string[]): ValidationIssue[] {
    const issues = validateManifest(manifest, filePaths)
    const store = useValidationStore.getState()
    store.clearIssues()
    store.addIssues(issues)
    return issues
  },

  dismiss: (id: string): void => useValidationStore.getState().removeIssue(id),

  clear: (): void => useValidationStore.getState().clearIssues(),
}
