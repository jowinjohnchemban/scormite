/**
 * Derives the launchable activities of a manifest: the items of the default
 * organization that reference a resource with an href, in document order.
 *
 * Pure manifest logic — what a learner can step through with Previous /
 * Next, and the exact path each one launches at. Sequencing rules are not
 * evaluated here (that is the runtime's job); this is flow order only.
 */

import type {
  LaunchableItem,
  Manifest,
  ManifestItem,
  ManifestOrganization,
  ManifestResource,
} from '@/shared/types'

/** The organization a learner sees: the declared default, else the first one. */
export function getDefaultOrganization(manifest: Manifest): ManifestOrganization | undefined {
  return (
    manifest.organizations.find((o) => o.identifier === manifest.defaultOrganizationIdentifier) ??
    manifest.organizations[0]
  )
}

/**
 * Appends an item's `parameters` to a resource href following the SCORM
 * Content Aggregation Model rules: a fragment is appended as-is (unless the
 * href already has one); a leading `?` or `&` is dropped and the rest is
 * joined with `&` when the href already carries a query string, else `?`.
 */
export function applyLaunchParameters(href: string, parameters: string | undefined): string {
  const params = parameters?.trim() ?? ''
  if (params === '') return href
  if (params.startsWith('#')) return href.includes('#') ? href : href + params
  const query = params.replace(/^[?&]+/, '')
  if (query === '') return href
  return href + (href.includes('?') ? '&' : '?') + query
}

export function getLaunchableItems(manifest: Manifest): LaunchableItem[] {
  const org = getDefaultOrganization(manifest)
  if (!org) return []
  const resources = new Map<string, ManifestResource>(
    manifest.resources.map((r) => [r.identifier, r]),
  )
  const out: LaunchableItem[] = []

  const walk = (items: ManifestItem[], depth: number): void => {
    for (const item of items) {
      const resource = item.identifierref ? resources.get(item.identifierref) : undefined
      if (resource?.href) {
        out.push({
          identifier: item.identifier,
          title: item.title || item.identifier,
          depth,
          resourceIdentifier: resource.identifier,
          scormType: resource.scormType ?? 'asset',
          launchPath: applyLaunchParameters(resource.href, item.parameters),
          launchData: item.launchData ?? {},
        })
      }
      walk(item.children, depth + 1)
    }
  }
  walk(org.items, 0)
  return out
}
