import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { loadZip, PackageLoadError } from '../services/PackageLoaderService'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST_12 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.scorm12"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>Sample Course</title>
      <item identifier="item1" identifierref="res1">
        <title>Module 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`

const MANIFEST_2004 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.example.scorm2004"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>Sample Course 2004</title>
      <item identifier="item1" identifierref="res1">
        <title>Module 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeZip(files: Record<string, string>, zipName: string): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], zipName, { type: 'application/zip' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PackageLoaderService.loadZip', () => {
  it('loads a SCORM 1.2 ZIP and detects the correct version', async () => {
    const file = await makeZip({ 'imsmanifest.xml': MANIFEST_12 }, 'sample-12.zip')
    const result = await loadZip(file)

    expect(result.scormVersion).toBe('1.2')
    expect(result.name).toBe('sample-12')
    expect(result.manifestXml).toBe(MANIFEST_12)
  })

  it('loads a SCORM 2004 ZIP and detects version + edition', async () => {
    const file = await makeZip({ 'imsmanifest.xml': MANIFEST_2004 }, 'sample-2004.zip')
    const result = await loadZip(file)

    expect(result.scormVersion).toBe('2004')
    expect(result.scormEdition).toBe('4th')
  })

  it('collects all file paths from the ZIP', async () => {
    const file = await makeZip(
      {
        'imsmanifest.xml': MANIFEST_12,
        'index.html': '<html></html>',
        'assets/style.css': 'body {}',
      },
      'sample.zip',
    )
    const result = await loadZip(file)

    expect(result.filePaths).toContain('imsmanifest.xml')
    expect(result.filePaths).toContain('index.html')
    expect(result.filePaths).toContain('assets/style.css')
  })

  it('throws PackageLoadError when imsmanifest.xml is missing', async () => {
    const file = await makeZip({ 'index.html': '<html></html>' }, 'bad.zip')

    await expect(loadZip(file)).rejects.toThrow(PackageLoadError)
    await expect(loadZip(file)).rejects.toThrow(/imsmanifest\.xml not found/i)
  })

  it('throws PackageLoadError for unrecognised manifest content', async () => {
    const file = await makeZip(
      { 'imsmanifest.xml': '<notscorm />' },
      'unknown.zip',
    )

    await expect(loadZip(file)).rejects.toThrow(PackageLoadError)
    await expect(loadZip(file)).rejects.toThrow(/could not be identified/i)
  })

  it('throws PackageLoadError for a non-ZIP file', async () => {
    const file = new File(['not a zip'], 'bad.zip', { type: 'application/zip' })

    await expect(loadZip(file)).rejects.toThrow(PackageLoadError)
    await expect(loadZip(file)).rejects.toThrow(/valid ZIP archive/i)
  })
})
