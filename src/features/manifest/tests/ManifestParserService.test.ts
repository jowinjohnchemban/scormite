/**
 * Unit tests for parseManifest — SCORM 1.2 + 2004 XML → Manifest entity.
 */

import { describe, expect, it } from 'vitest'
import { ManifestParseError, parseManifest } from '../services/ManifestParserService'

const MANIFEST_12 = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="course-1" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <imsmd:lom xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1">
      <imsmd:general>
        <imsmd:title><imsmd:langstring>Sample 1.2 Course</imsmd:langstring></imsmd:title>
      </imsmd:general>
    </imsmd:lom>
  </metadata>
  <organizations default="org-1">
    <organization identifier="org-1">
      <title>Sample Course</title>
      <item identifier="item-1" identifierref="res-1">
        <title>Lesson 1</title>
        <item identifier="item-1-1" identifierref="res-2" isvisible="false">
          <title>Nested Lesson</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="course/main.js"/>
    </resource>
    <resource identifier="res-2" type="webcontent" adlcp:scormtype="asset" href="about.html">
      <file href="about.html"/>
    </resource>
  </resources>
</manifest>`

describe('parseManifest — SCORM 1.2', () => {
  const manifest = parseManifest(MANIFEST_12)

  it('parses metadata schema, version, and title', () => {
    expect(manifest.metadata).toEqual({
      schema: 'ADL SCORM',
      schemaVersion: '1.2',
      title: 'Sample 1.2 Course',
    })
  })

  it('parses the default organization identifier', () => {
    expect(manifest.defaultOrganizationIdentifier).toBe('org-1')
  })

  it('parses organizations with nested items', () => {
    expect(manifest.organizations).toHaveLength(1)
    const org = manifest.organizations[0]
    expect(org).toMatchObject({ identifier: 'org-1', title: 'Sample Course' })
    expect(org?.items).toHaveLength(1)
    const item = org?.items[0]
    expect(item).toMatchObject({
      identifier: 'item-1',
      title: 'Lesson 1',
      identifierref: 'res-1',
      isvisible: true,
    })
    expect(item?.children).toHaveLength(1)
    expect(item?.children[0]).toMatchObject({
      identifier: 'item-1-1',
      identifierref: 'res-2',
      isvisible: false,
    })
  })

  it('parses resources with files and scorm types', () => {
    expect(manifest.resources).toHaveLength(2)
    const sco = manifest.resources[0]
    expect(sco).toMatchObject({
      identifier: 'res-1',
      type: 'webcontent',
      href: 'index.html',
      scormType: 'sco',
      files: ['index.html', 'course/main.js'],
    })
    expect(manifest.resources[1]).toMatchObject({
      identifier: 'res-2',
      scormType: 'asset',
    })
  })
})

describe('parseManifest — SCORM 2004', () => {
  it('parses a 2004 manifest with missing optional metadata', () => {
    const manifest = parseManifest(`<?xml version="1.0"?>
<manifest identifier="m-2004"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss_v1p0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="o1">
    <organization identifier="o1">
      <title>2004 Course</title>
      <item identifier="i1" identifierref="r1"><title>Intro</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" adlcp:scormType="sco" href="start.html">
      <file href="start.html"/>
    </resource>
  </resources>
</manifest>`)
    expect(manifest.metadata.schemaVersion).toBe('2004 4th Edition')
    expect(manifest.defaultOrganizationIdentifier).toBe('o1')
    expect(manifest.resources[0]?.scormType).toBe('sco')
    // Note: attributes are case-sensitive; the 2004 sample above uses
    // adlcp:scormType, and the parser accepts both casings.
  })

  it('handles missing schemaversion and no organization items', () => {
    const manifest = parseManifest(`<manifest identifier="bare">
  <organizations default="o1">
    <organization identifier="o1"><title>Bare</title></organization>
  </organizations>
  <resources/>
</manifest>`)
    expect(manifest.metadata).toEqual({})
    expect(manifest.defaultOrganizationIdentifier).toBe('o1')
    expect(manifest.organizations[0]?.items).toEqual([])
    expect(manifest.resources).toEqual([])
  })
})

describe('parseManifest — errors', () => {
  it('throws ManifestParseError for malformed XML', () => {
    expect(() => parseManifest('<manifest><broken')).toThrow(ManifestParseError)
  })

  it('throws ManifestParseError when the root element is not <manifest>', () => {
    expect(() => parseManifest('<html><body/></html>')).toThrow(ManifestParseError)
    expect(() => parseManifest('')).toThrow(ManifestParseError)
  })

  it('includes the underlying XML error message', () => {
    try {
      parseManifest('<manifest><broken')
      throw new Error('expected parse to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestParseError)
      expect((e as ManifestParseError).message).toMatch(/Failed to parse/)
    }
  })
})
