/**
 * Detects the SCORM version (1.2 vs 2004) from raw imsmanifest.xml text.
 *
 * Strategy:
 *   1. Check <metadata><schema> + <schemaversion> — most reliable.
 *   2. Fall back to XML namespace detection in the <manifest> element.
 *
 * Returns null when the content is unrecognisable as a SCORM manifest.
 */

import type { ScormEdition, ScormVersion } from '@/shared/types'

export interface DetectedVersion {
  version: ScormVersion
  edition?: ScormEdition
}

/** SCORM 1.2 namespace indicator. */
const NS_12 = 'adlcp_rootv1p2'
/** SCORM 2004 namespace indicators. */
const NS_2004 = ['adlcp_v1p3', 'adlseq_v1p3', 'adlnav_v1p3', 'imsss_v1p0']

export function detectScormVersion(manifestXml: string): DetectedVersion | null {
  // --- Strategy 1: schema + schemaversion metadata ---
  const schemaVersionMatch = /<schemaversion[^>]*>\s*([^<]+?)\s*<\/schemaversion>/i.exec(
    manifestXml,
  )
  if (schemaVersionMatch) {
    const sv = schemaVersionMatch[1]?.trim() ?? ''
    if (/^1\.2$/i.test(sv)) {
      return { version: '1.2' }
    }
    if (/2004\s*4th/i.test(sv)) {
      return { version: '2004', edition: '4th' }
    }
    if (/2004\s*3rd/i.test(sv)) {
      return { version: '2004', edition: '3rd' }
    }
    if (/2004\s*2nd/i.test(sv)) {
      return { version: '2004', edition: '2nd' }
    }
    if (/2004/i.test(sv)) {
      // Edition not specified explicitly — treat as generic 2004.
      return { version: '2004' }
    }
  }

  // --- Strategy 2: XML namespace detection ---
  if (manifestXml.includes(NS_12)) {
    return { version: '1.2' }
  }
  for (const ns of NS_2004) {
    if (manifestXml.includes(ns)) {
      return { version: '2004' }
    }
  }

  return null
}
