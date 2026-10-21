/**
 * Everything needed to open a package — unzip, manifest parsing, the
 * service-worker file cache, and the SCORM runtime — behind one module, so
 * the app loads it on demand (`import()`) when the first package is opened.
 * The start screen never downloads jszip, the XML parser, or scorm-again.
 */

import { loadZip, PackageLoadError } from '@/features/package-loader'
import { getActivityTree, getLaunchableItems, ManifestParseError, parseManifest } from '@/features/manifest'
import { cachePackageFiles } from '@/features/player'
import type { SequencingOptions } from '@/features/runtime'
import type { LaunchableItem, Manifest, Package, ScormEdition, ScormVersion } from '@/shared/types'
import { CourseSession } from './CourseSession'

export interface ParsedPackage {
  name: string
  scormVersion: ScormVersion
  scormEdition?: ScormEdition
  manifest: Manifest
  items: LaunchableItem[]
  filePaths: string[]
  /** Set when the manifest sat inside a folder of the zip. */
  rootFolder?: string
  /** Copy the package's files into the player's cache under `packageId`. */
  cacheFiles: (packageId: string) => Promise<void>
}

/** Read and validate a package file; throws `OpenPackageError` with a user-facing message. */
export async function parsePackage(file: File): Promise<ParsedPackage> {
  try {
    const raw = await loadZip(file)
    const manifest = parseManifest(raw.manifestXml)
    const items = getLaunchableItems(manifest)
    if (items.length === 0) {
      throw new PackageLoadError(
        `"${file.name}" has no launchable item: no organization item references a resource with an href.`,
      )
    }
    return {
      name: raw.name,
      scormVersion: raw.scormVersion,
      ...(raw.scormEdition !== undefined ? { scormEdition: raw.scormEdition } : {}),
      manifest,
      items,
      filePaths: raw.filePaths,
      ...(raw.rootFolder !== undefined ? { rootFolder: raw.rootFolder } : {}),
      cacheFiles: async (packageId) => {
        try {
          await cachePackageFiles(packageId, raw.filePaths, raw.getFile)
        } catch (error) {
          throw new OpenPackageError(userMessage(error), { cause: error })
        }
      },
    }
  } catch (error) {
    throw new OpenPackageError(userMessage(error), { cause: error })
  }
}

/** A failure to open a package, with a message fit to show the user. */
export class OpenPackageError extends Error {
  override readonly name = 'OpenPackageError'
}

function userMessage(error: unknown): string {
  if (error instanceof PackageLoadError || error instanceof ManifestParseError) return error.message
  if (error instanceof Error && /service worker/i.test(error.message)) {
    return 'The package player could not start. Reload the page and try again — private browsing modes that block service workers are not supported.'
  }
  return 'An unexpected error occurred while loading the package.'
}

/** SCORM 2004 courses are played by the sequencing engine. */
function sequencingFor(pkg: Package): SequencingOptions | null {
  if (pkg.scormVersion !== '2004') return null
  const activityTree = getActivityTree(pkg.manifest)
  if (!activityTree) return null
  return {
    activityTree,
    ...(pkg.manifest.sequencingCollections ? { collections: pkg.manifest.sequencingCollections } : {}),
  }
}

export function createCourseSession(pkg: Package, items: LaunchableItem[]): CourseSession {
  return new CourseSession(pkg, items, sequencingFor(pkg))
}
