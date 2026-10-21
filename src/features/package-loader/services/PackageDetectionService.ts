/**
 * Detects the SCORM runtime version (1.2 vs 2004) and, for 2004, the edition
 * (2nd / 3rd / 4th) from raw imsmanifest.xml text. SCORM 1.1 packages map to
 * the 1.2 runtime.
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

/**
 * SCORM 1.2 namespace indicators. SCORM 1.1 (`adl_cp_rootv1p1`) is included:
 * its runtime API is the `window.API` / `LMS*` surface 1.2 kept, so 1.1
 * packages run on the 1.2 runtime exactly as they do on production LMSs.
 */
const NS_12 = ['adlcp_rootv1p2', 'adl_cp_rootv1p1', 'adlcp_rootv1p1']
/** SCORM 2004 namespace indicators. */
const NS_2004 = ['adlcp_v1p3', 'adlseq_v1p3', 'adlnav_v1p3', 'imsss_v1p0']

export function detectScormVersion(manifestXml: string): DetectedVersion | null {
  // --- Strategy 1: schema + schemaversion metadata ---
  const schemaVersionMatch = /<schemaversion[^>]*>\s*([^<]+?)\s*<\/schemaversion>/i.exec(
    manifestXml,
  )
  if (schemaVersionMatch) {
    const sv = schemaVersionMatch[1]?.trim() ?? ''
    if (/^1\.[12]$/.test(sv)) {
      return { version: '1.2' }
    }
    // "CAM 1.3" is the schemaversion the SCORM 2004 2nd Edition spec mandates.
    if (/^CAM\s*1\.3$/i.test(sv)) {
      return { version: '2004', edition: '2nd' }
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
  if (NS_12.some((ns) => manifestXml.includes(ns))) {
    return { version: '1.2' }
  }
  for (const ns of NS_2004) {
    if (manifestXml.includes(ns)) {
      return { version: '2004' }
    }
  }

  return null
}
