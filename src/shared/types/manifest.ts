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

/**
 * Per-item launch data the manifest hands to the SCO through the runtime
 * data model (SCORM 1.2 `adlcp:*` item children, SCORM 2004 `adlcp:*` and
 * `imsss:*` item children). Values are kept as the raw manifest strings.
 */
export interface ManifestItemLaunchData {
  /** `adlcp:datafromlms` / `adlcp:dataFromLMS` → `cmi.launch_data`. */
  dataFromLms?: string
  /** SCORM 1.2 `adlcp:masteryscore` → `cmi.student_data.mastery_score`. */
  masteryScore?: string
  /** SCORM 1.2 `adlcp:maxtimeallowed` → `cmi.student_data.max_time_allowed`. */
  maxTimeAllowed?: string
  /** `adlcp:timelimitaction` / `adlcp:timeLimitAction`. */
  timeLimitAction?: string
  /** SCORM 2004 `adlcp:completionThreshold` → `cmi.completion_threshold`. */
  completionThreshold?: string
  /**
   * SCORM 2004 primary objective `imsss:minNormalizedMeasure` (only when
   * `satisfiedByMeasure="true"`) → `cmi.scaled_passing_score`.
   */
  scaledPassingScore?: string
}

export interface ManifestItem {
  identifier: string
  title: string
  /** Identifierref links to a ManifestResource. */
  identifierref?: string
  /** isvisible defaults to true per SCORM spec. */
  isvisible: boolean
  /** Query string / fragment appended to the resource href at launch. */
  parameters?: string
  /** Launch data to seed into the runtime before the SCO initializes. */
  launchData?: ManifestItemLaunchData
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
  /**
   * URL of the launch file, relative to the package root. Any `xml:base`
   * declared on the manifest, `<resources>`, or the resource itself has
   * already been applied.
   */
  href?: string
  /** adlcp:scormType: 'sco' | 'asset' */
  scormType?: 'sco' | 'asset'
  /** All files declared in the resource, relative to the package root (`xml:base` applied). */
  files: string[]
}

/**
 * One organization item that can actually be launched: it references a
 * resource with an href. Derived from the manifest in document order, which
 * is the order a learner steps through with Previous / Next.
 */
export interface LaunchableItem {
  /** Item identifier — unique within the manifest. */
  identifier: string
  title: string
  /** Nesting depth inside the organization (0 = top level). */
  depth: number
  /** Resource identifier the item points at. */
  resourceIdentifier: string
  /** 'sco' talks to the runtime API; 'asset' is plain content. */
  scormType: 'sco' | 'asset'
  /** Launch path relative to the package root, with item parameters applied. */
  launchPath: string
  launchData: ManifestItemLaunchData
}

export interface Manifest {
  /** identifier of the default organization */
  defaultOrganizationIdentifier?: string
  organizations: ManifestOrganization[]
  resources: ManifestResource[]
  metadata: ManifestMetadata
}
