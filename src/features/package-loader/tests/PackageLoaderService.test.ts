/**
 * Unit tests for loadZip — archive reading, manifest location, and file
 * path normalisation.
 */

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { findPackageRoot, loadZip, PackageLoadError } from '../services/PackageLoaderService'

const MANIFEST_12 = `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations/><resources/>
</manifest>`

async function zipFile(name: string, files: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([bytes], name, { type: 'application/zip' })
}

describe('findPackageRoot', () => {
  it('prefers a manifest at the archive root', () => {
    expect(findPackageRoot(['course/imsmanifest.xml', 'imsmanifest.xml'])).toEqual({
      prefix: '',
      manifestName: 'imsmanifest.xml',
    })
  })

  it('accepts a single wrapping folder', () => {
    expect(findPackageRoot(['course/imsmanifest.xml', 'course/index.html'])).toEqual({
      prefix: 'course/',
      manifestName: 'imsmanifest.xml',
    })
  })

  it('rejects ambiguous or deeper layouts', () => {
    expect(findPackageRoot(['a/imsmanifest.xml', 'b/imsmanifest.xml'])).toBeNull()
    expect(findPackageRoot(['a/b/imsmanifest.xml'])).toBeNull()
    expect(findPackageRoot(['index.html'])).toBeNull()
  })
})

describe('loadZip', () => {
  it('reads a root-level package', async () => {
    const raw = await loadZip(
      await zipFile('course.zip', { 'imsmanifest.xml': MANIFEST_12, 'index.html': '<p>hi</p>' }),
    )
    expect(raw.name).toBe('course')
    expect(raw.scormVersion).toBe('1.2')
    expect(raw.rootFolder).toBeUndefined()
    expect(raw.filePaths.sort()).toEqual(['imsmanifest.xml', 'index.html'])
    expect(new TextDecoder().decode(await raw.getFile('index.html'))).toBe('<p>hi</p>')
  })

  it('re-roots a package zipped inside its folder and drops macOS junk', async () => {
    const raw = await loadZip(
      await zipFile('wrapped.zip', {
        'My Course/imsmanifest.xml': MANIFEST_12,
        'My Course/res/index.html': 'x',
        'My Course/.DS_Store': 'junk',
        '__MACOSX/My Course/._index.html': 'junk',
      }),
    )
    expect(raw.rootFolder).toBe('My Course')
    expect(raw.filePaths.sort()).toEqual(['imsmanifest.xml', 'res/index.html'])
    expect(new TextDecoder().decode(await raw.getFile('res/index.html'))).toBe('x')
  })

  it('rejects a zip without a manifest', async () => {
    await expect(loadZip(await zipFile('nope.zip', { 'index.html': 'x' }))).rejects.toBeInstanceOf(PackageLoadError)
  })

  it('rejects something that is not a zip', async () => {
    const notZip = new File([new TextEncoder().encode('plain text')], 'notes.zip')
    await expect(loadZip(notZip)).rejects.toThrow(/valid ZIP archive/)
  })
})
