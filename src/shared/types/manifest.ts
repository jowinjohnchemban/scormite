/**
 * Manifest entity — parsed from imsmanifest.xml.
 * Owned by the manifest feature (construction + mutation lives there);
 * type lives in shared so all features and the app layer can reference it
 * without violating the ESLint feature-boundary rules.
 */

export interface ManifestMetadata {
  schema?: string
  schemaVersion?: string
  title?: string
}

export interface ManifestItem {
  identifier: string
  title: string
  /** Identifierref links to a ManifestResource. */
  identifierref?: string
  /** isvisible defaults to true per SCORM spec. */
  isvisible: boolean
  children: ManifestItem[]
}

export interface ManifestOrganization {
  identifier: string
  title: string
  items: ManifestItem[]
}

export interface ManifestResource {
  identifier: string
  /** SCORM resource type string, e.g. "webcontent". */
  type: string
  /** URL of the launch file, relative to the package root. */
  href?: string
  /** adlcp:scormType: 'sco' | 'asset' */
  scormType?: 'sco' | 'asset'
  /** All files declared in the resource, relative to the package root. */
  files: string[]
}

export interface Manifest {
  /** identifier of the default organization */
  defaultOrganizationIdentifier?: string
  organizations: ManifestOrganization[]
  resources: ManifestResource[]
  metadata: ManifestMetadata
}
