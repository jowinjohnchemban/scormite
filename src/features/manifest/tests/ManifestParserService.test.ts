import { describe, expect, it } from 'vitest'
import { parseManifest, ManifestParseError } from '../services/ManifestParserService'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCORM_12_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.scorm12"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>SCORM 1.2 Sample Course</title>
      <item identifier="item1" identifierref="res1" isvisible="true">
        <title>Module 1</title>
        <item identifier="item1a" identifierref="res1a">
          <title>Lesson 1a</title>
        </item>
      </item>
      <item identifier="item2" identifierref="res2" isvisible="false">
        <title>Hidden Item</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="style.css"/>
    </resource>
    <resource identifier="res1a" type="webcontent" adlcp:scormtype="sco" href="lesson1a.html">
      <file href="lesson1a.html"/>
    </resource>
    <resource identifier="res2" type="webcontent" adlcp:scormtype="asset" href="assets/image.png">
      <file href="assets/image.png"/>
    </resource>
  </resources>
</manifest>`

const SCORM_2004_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.scorm2004"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imssequencing_v1p0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-001">
    <organization identifier="ORG-001">
      <title>SCORM 2004 Sample Course</title>
      <item identifier="ITEM-001" identifierref="RES-001">
        <title>Topic 1</title>
      </item>
      <item identifier="ITEM-002" identifierref="RES-002">
        <title>Topic 2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-001" type="webcontent" adlcp:scormType="sco" href="topic1/index.html">
      <file href="topic1/index.html"/>
    </resource>
    <resource identifier="RES-002" type="webcontent" adlcp:scormType="sco" href="topic2/index.html">
      <file href="topic2/index.html"/>
    </resource>
  </resources>
</manifest>`

// ---------------------------------------------------------------------------
// Tests: SCORM 1.2
// ---------------------------------------------------------------------------

describe('ManifestParserService — SCORM 1.2', () => {
  it('parses metadata correctly', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    expect(manifest.metadata.schema).toBe('ADL SCORM')
    expect(manifest.metadata.schemaVersion).toBe('1.2')
  })

  it('sets the default organization identifier', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    expect(manifest.defaultOrganizationIdentifier).toBe('org1')
  })

  it('parses organization and item tree', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    expect(manifest.organizations).toHaveLength(1)

    const org = manifest.organizations[0]!
    expect(org.identifier).toBe('org1')
    expect(org.title).toBe('SCORM 1.2 Sample Course')
    expect(org.items).toHaveLength(2)
  })

  it('parses nested items', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    const topItem = manifest.organizations[0]!.items[0]!
    expect(topItem.identifier).toBe('item1')
    expect(topItem.title).toBe('Module 1')
    expect(topItem.children).toHaveLength(1)
    expect(topItem.children[0]!.identifier).toBe('item1a')
  })

  it('sets isvisible=false on hidden items', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    const hiddenItem = manifest.organizations[0]!.items[1]!
    expect(hiddenItem.isvisible).toBe(false)
  })

  it('parses resources with scormType', () => {
    const manifest = parseManifest(SCORM_12_MANIFEST)
    expect(manifest.resources).toHaveLength(3)

    const sco = manifest.resources[0]!
    expect(sco.identifier).toBe('res1')
    expect(sco.scormType).toBe('sco')
    expect(sco.href).toBe('index.html')
    expect(sco.files).toEqual(['index.html', 'style.css'])

    const asset = manifest.resources[2]!
    expect(asset.scormType).toBe('asset')
  })
})

// ---------------------------------------------------------------------------
// Tests: SCORM 2004
// ---------------------------------------------------------------------------

describe('ManifestParserService — SCORM 2004', () => {
  it('parses metadata correctly', () => {
    const manifest = parseManifest(SCORM_2004_MANIFEST)
    expect(manifest.metadata.schemaVersion).toBe('2004 4th Edition')
  })

  it('parses organizations with correct default', () => {
    const manifest = parseManifest(SCORM_2004_MANIFEST)
    expect(manifest.defaultOrganizationIdentifier).toBe('ORG-001')
    expect(manifest.organizations[0]!.items).toHaveLength(2)
  })

  it('parses resources with camelCase scormType attribute', () => {
    const manifest = parseManifest(SCORM_2004_MANIFEST)
    expect(manifest.resources[0]!.scormType).toBe('sco')
    expect(manifest.resources[1]!.scormType).toBe('sco')
  })

  it('parses resource href correctly', () => {
    const manifest = parseManifest(SCORM_2004_MANIFEST)
    expect(manifest.resources[0]!.href).toBe('topic1/index.html')
  })
})

// ---------------------------------------------------------------------------
// Tests: error handling
// ---------------------------------------------------------------------------

describe('ManifestParserService — error handling', () => {
  it('throws ManifestParseError for empty input', () => {
    expect(() => parseManifest('')).toThrow(ManifestParseError)
  })

  it('throws ManifestParseError when no <manifest> root', () => {
    expect(() => parseManifest('<root><child /></root>')).toThrow(ManifestParseError)
  })
})
