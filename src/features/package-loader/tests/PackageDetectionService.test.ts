import { describe, expect, it } from 'vitest'
import { detectScormVersion } from '../services/PackageDetectionService'

// Minimal SCORM 1.2 manifest snippet
const SCORM_12_SCHEMA = `<?xml version="1.0"?>
<manifest xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
</manifest>`

// SCORM 1.2 detected only via namespace (no schemaversion element)
const SCORM_12_NAMESPACE = `<?xml version="1.0"?>
<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
</manifest>`

const SCORM_2004_2ND = `<?xml version="1.0"?>
<manifest>
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 2nd Edition</schemaversion>
  </metadata>
</manifest>`

const SCORM_2004_3RD = `<?xml version="1.0"?>
<manifest>
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
</manifest>`

const SCORM_2004_4TH = `<?xml version="1.0"?>
<manifest>
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
</manifest>`

const SCORM_2004_NAMESPACE = `<?xml version="1.0"?>
<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
</manifest>`

const NOT_SCORM = `<?xml version="1.0"?>
<something><else /></something>`

describe('detectScormVersion', () => {
  it('detects SCORM 1.2 from schemaversion', () => {
    const result = detectScormVersion(SCORM_12_SCHEMA)
    expect(result).toEqual({ version: '1.2' })
  })

  it('detects SCORM 1.2 from namespace when no schemaversion', () => {
    const result = detectScormVersion(SCORM_12_NAMESPACE)
    expect(result).toEqual({ version: '1.2' })
  })

  it('detects SCORM 2004 2nd Edition', () => {
    const result = detectScormVersion(SCORM_2004_2ND)
    expect(result).toEqual({ version: '2004', edition: '2nd' })
  })

  it('detects SCORM 2004 3rd Edition', () => {
    const result = detectScormVersion(SCORM_2004_3RD)
    expect(result).toEqual({ version: '2004', edition: '3rd' })
  })

  it('detects SCORM 2004 4th Edition', () => {
    const result = detectScormVersion(SCORM_2004_4TH)
    expect(result).toEqual({ version: '2004', edition: '4th' })
  })

  it('detects SCORM 2004 from namespace when no schemaversion', () => {
    const result = detectScormVersion(SCORM_2004_NAMESPACE)
    expect(result).toEqual({ version: '2004' })
  })

  it('returns null for non-SCORM XML', () => {
    expect(detectScormVersion(NOT_SCORM)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectScormVersion('')).toBeNull()
  })
})
