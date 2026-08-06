/**
 * Package entity — a loaded SCORM ZIP or folder.
 * Owned by the package-loader feature (construction lives there);
 * type lives in shared so all features and the app layer can reference it
 * without violating the ESLint feature-boundary rules.
 */

import type { Manifest } from './manifest'

export type ScormVersion = '1.2' | '2004'
export type ScormEdition = '2nd' | '3rd' | '4th'

export interface Package {
  id: string
  /** File name (without extension) or directory name. */
  name: string
  sourceType: 'zip'
  scormVersion: ScormVersion
  /** Populated for SCORM 2004 packages only. */
  scormEdition?: ScormEdition
  manifest: Manifest
  /** Path to the launch SCO, relative to the package root. */
  launchUrl: string
  loadedAt: Date
}
