/**
 * The SCORM 2004 activity tree of a manifest: the default organization is
 * the root activity, its items are the child activities, and each carries
 * the sequencing declared for it. This is the structure a sequencing engine
 * runs on.
 */

import type { ActivityDefinition, Manifest, ManifestItem } from '@/shared/types'
import { getDefaultOrganization } from './launchables'

function toActivity(item: ManifestItem): ActivityDefinition | null {
  const children = item.children.map(toActivity).filter((a): a is ActivityDefinition => a !== null)
  // An item with neither a resource nor children is empty in the manifest;
  // a sequencer cannot deliver it, so it is not part of the tree.
  if (!item.identifierref && children.length === 0) return null
  return {
    id: item.identifier,
    title: item.title || item.identifier,
    isVisible: item.isvisible,
    ...(item.sequencing !== undefined ? { sequencing: item.sequencing } : {}),
    ...(item.completionThreshold !== undefined ? { completionThreshold: item.completionThreshold } : {}),
    ...(item.hideLmsUi !== undefined ? { hideLmsUi: item.hideLmsUi } : {}),
    children,
  }
}

export function getActivityTree(manifest: Manifest): ActivityDefinition | null {
  const org = getDefaultOrganization(manifest)
  if (!org) return null
  const children = org.items.map(toActivity).filter((a): a is ActivityDefinition => a !== null)
  if (children.length === 0) return null
  return {
    id: org.identifier,
    title: org.title || org.identifier,
    isVisible: true,
    ...(org.sequencing !== undefined ? { sequencing: org.sequencing } : {}),
    children,
  }
}
