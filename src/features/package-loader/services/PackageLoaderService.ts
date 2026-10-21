/**
 * Reads a SCORM ZIP file and extracts the information needed to build a
 * Package entity.  Does NOT parse the manifest XML in full — that's the
 * manifest feature's job.  Returns a RawPackageData that the app layer
 * combines with the parsed Manifest to assemble the final Package.
 */

import JSZip from 'jszip'
import type { ScormEdition, ScormVersion } from '@/shared/types'
import { detectScormVersion } from './PackageDetectionService'

export class PackageLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackageLoadError'
  }
}

/** Intermediate data extracted from the ZIP before manifest parsing. */
export interface RawPackageData {
  /** Display name derived from the ZIP file name. */
  name: string
  scormVersion: ScormVersion
  scormEdition?: ScormEdition
  /** Raw XML text of imsmanifest.xml — passed to ManifestParserService. */
  manifestXml: string
  /** All file paths found in the package, relative to its root, forward-slash normalised. */
  filePaths: string[]
  /**
   * Set when the manifest was found one folder down instead of at the
   * archive root — the folder that was treated as the package root.
   */
  rootFolder?: string
  /**
   * Read any file from the ZIP by its normalised path.
   * The returned Uint8Array is decoded from the ZIP entry.
   */
  getFile: (path: string) => Promise<Uint8Array>
}

/**
 * Loads a SCORM ZIP file (as a browser File object) and returns the raw
 * package data.  Throws PackageLoadError for invalid/unrecognised inputs.
 */
export async function loadZip(file: File): Promise<RawPackageData> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new PackageLoadError(`Could not read ZIP file "${file.name}". Make sure it is a valid ZIP archive.`)
  }

  // Archive entries, forward-slash normalised, without directories and
  // without the `__MACOSX/` resource-fork folder macOS Finder adds to zips.
  const entries = new Map<string, JSZip.JSZipObject>()
  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const path = rawPath.replace(/\\/g, '/')
    if (path.startsWith('__MACOSX/') || path.split('/').pop() === '.DS_Store') continue
    entries.set(path, entry)
  }

  const root = findPackageRoot([...entries.keys()])
  if (root === null) {
    throw new PackageLoadError(
      `"${file.name}" does not appear to be a SCORM package: imsmanifest.xml not found at the root.`,
    )
  }

  // SCORM requires the manifest at the package root. A zip of the course
  // *folder* (manifest one level down) is the most common packaging mistake;
  // treat that folder as the root so the course still runs.
  const rooted = new Map<string, JSZip.JSZipObject>()
  for (const [path, entry] of entries) {
    if (path.startsWith(root.prefix)) rooted.set(path.slice(root.prefix.length), entry)
  }

  const manifestEntry = rooted.get(root.manifestName)
  if (!manifestEntry) {
    throw new PackageLoadError(`"${file.name}": imsmanifest.xml could not be read.`)
  }
  const manifestXml = await manifestEntry.async('string')

  const detected = detectScormVersion(manifestXml)
  if (!detected) {
    throw new PackageLoadError(
      `"${file.name}" contains an imsmanifest.xml but it could not be identified as a SCORM 1.2 or SCORM 2004 package.`,
    )
  }

  const name = file.name.replace(/\.zip$/i, '')

  return {
    name,
    scormVersion: detected.version,
    ...(detected.edition !== undefined ? { scormEdition: detected.edition } : {}),
    manifestXml,
    filePaths: [...rooted.keys()],
    ...(root.prefix !== '' ? { rootFolder: root.prefix.slice(0, -1) } : {}),
    getFile: async (path: string) => {
      const entry = rooted.get(path)
      if (!entry) throw new Error(`File not found in package: ${path}`)
      return entry.async('uint8array')
    },
  }
}

/**
 * Locates imsmanifest.xml: at the archive root (any casing), or — when the
 * archive holds exactly one top-level folder containing it — inside that
 * folder. Returns the path prefix to strip and the manifest's own file name.
 */
export function findPackageRoot(
  paths: string[],
): { prefix: string; manifestName: string } | null {
  const atRoot = paths.find((p) => p === 'imsmanifest.xml') ?? paths.find((p) => /^imsmanifest\.xml$/i.test(p))
  if (atRoot) return { prefix: '', manifestName: atRoot }

  const nested = paths.filter((p) => /^[^/]+\/imsmanifest\.xml$/i.test(p))
  const [only] = nested
  if (nested.length !== 1 || only === undefined) return null
  const slash = only.indexOf('/')
  return { prefix: only.slice(0, slash + 1), manifestName: only.slice(slash + 1) }
}
