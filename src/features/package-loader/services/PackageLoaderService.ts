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
  /** All file paths found in the ZIP, normalised to forward-slashes. */
  filePaths: string[]
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

  // Find imsmanifest.xml — SCORM requires it at the root, exact case.
  const manifestEntry =
    zip.file('imsmanifest.xml') ??
    // Some authoring tools emit different casing — be lenient.
    zip.file(/^imsmanifest\.xml$/i)[0]

  if (!manifestEntry) {
    throw new PackageLoadError(
      `"${file.name}" does not appear to be a SCORM package: imsmanifest.xml not found at the root.`,
    )
  }

  const manifestXml = await manifestEntry.async('string')

  const detected = detectScormVersion(manifestXml)
  if (!detected) {
    throw new PackageLoadError(
      `"${file.name}" contains an imsmanifest.xml but it could not be identified as a SCORM 1.2 or SCORM 2004 package.`,
    )
  }

  const filePaths = Object.keys(zip.files)
    .filter((p) => !zip.files[p]?.dir)
    .map((p) => p.replace(/\\/g, '/'))

  const name = file.name.replace(/\.zip$/i, '')

  return {
    name,
    scormVersion: detected.version,
    ...(detected.edition !== undefined ? { scormEdition: detected.edition } : {}),
    manifestXml,
    filePaths,
    getFile: async (path: string) => {
      const entry = zip.file(path) ?? zip.file(path.replace(/\//g, '\\'))
      if (!entry) throw new Error(`File not found in package: ${path}`)
      return entry.async('uint8array')
    },
  }
}
