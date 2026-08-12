/**
 * Unit tests for detectScormVersion — pure SCORM 1.2 vs 2004 detection.
 */

import { describe, expect, it } from 'vitest'
import { detectScormVersion } from '../services/PackageDetectionService'

describe('detectScormVersion', () => {
  it('detects 1.2 from the <schemaversion> metadata', () => {
    const xml = '<?xml version="1.0"?><manifest><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata></manifest>'
    expect(detectScormVersion(xml)).toEqual({ version: '1.2' })
  })

  it('detects 1.2 with whitespace padding inside schemaversion', () => {
    const xml = '<metadata><schemaversion>  1.2  </schemaversion></metadata>'
    expect(detectScormVersion(xml)).toEqual({ version: '1.2' })
  })

  it('detects 2004 4th edition', () => {
    const xml = '<metadata><schemaversion>2004 4th Edition</schemaversion></metadata>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004', edition: '4th' })
  })

  it('detects 2004 3rd edition', () => {
    const xml = '<metadata><schemaversion>2004 3rd Edition</schemaversion></metadata>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004', edition: '3rd' })
  })

  it('detects 2004 2nd edition', () => {
    const xml = '<metadata><schemaversion>2004 2nd Edition</schemaversion></metadata>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004', edition: '2nd' })
  })

  it('detects generic 2004 when no edition is specified', () => {
    const xml = '<metadata><schemaversion>2004</schemaversion></metadata>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004' })
  })

  it('falls back to the 1.2 namespace when metadata is absent', () => {
    const xml = '<manifest xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><organizations/></manifest>'
    expect(detectScormVersion(xml)).toEqual({ version: '1.2' })
  })

  it('falls back to a 2004 namespace when metadata is absent', () => {
    const xml = '<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"><organizations/></manifest>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004' })
  })

  it('detects 2004 from the adlseq namespace', () => {
    const xml = '<manifest xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"><organizations/></manifest>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004' })
  })

  it('detects 2004 from the imsss namespace', () => {
    const xml = '<manifest xmlns:imsss="http://www.imsglobal.org/xsd/imsss_v1p0"><organizations/></manifest>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004' })
  })

  it('returns null for unrecognisable content', () => {
    expect(detectScormVersion('<html><body>not scorm</body></html>')).toBeNull()
    expect(detectScormVersion('')).toBeNull()
  })

  it('prefers explicit metadata over a conflicting namespace', () => {
    const xml = '<metadata><schemaversion>2004 3rd Edition</schemaversion></metadata><manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"/>'
    expect(detectScormVersion(xml)).toEqual({ version: '2004', edition: '3rd' })
  })
})
