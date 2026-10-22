/**
 * Parses a raw imsmanifest.xml string into the Manifest entity.
 *
 * Supports both SCORM 1.2 and SCORM 2004 manifests. Uses fast-xml-parser
 * for XML parsing. Element and attribute lookups are namespace-prefix
 * agnostic and case-insensitive on the local name: real-world manifests bind
 * `adlcp` / `imsss` to whatever prefix their authoring tool likes and are
 * inconsistent about `scormtype` vs `scormType`, so matching on the exact
 * qualified name silently drops data.
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  Manifest,
  ManifestItem,
  ManifestItemLaunchData,
  ManifestMetadata,
  ManifestOrganization,
  ManifestResource,
} from '@/shared/types'
import { SequencingParser } from './SequencingParser'
import { attr, child, isNode, localName, text, toArray } from './xmlNode'

const SEQUENCING = new SequencingParser()

export class ManifestParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestParseError'
  }
}

// ---------------------------------------------------------------------------
// Parser configuration
// ---------------------------------------------------------------------------

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Always produce arrays for these elements so we never have to
  // branch on "is this an object or array?" downstream.
  isArray: (tagName) => ['organization', 'item', 'resource', 'file', 'dependency'].includes(localName(tagName)),
  // Treat all text content as strings — prevents '1.2' being coerced to number.
  parseTagValue: false,
  // Trim whitespace from text values.
  trimValues: true,
  // Parse attribute values as strings (SCORM identifiers can look numeric).
  parseAttributeValue: false,
})

// ---------------------------------------------------------------------------
// xml:base resolution
// ---------------------------------------------------------------------------

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i

/**
 * Resolves `href` against a chain of `xml:base` values (outermost first).
 * Bases are treated as directories even without a trailing slash — authoring
 * tools omit it often enough that strict URL resolution would break real
 * packages.
 */
export function resolveXmlBase(bases: (string | undefined)[], href: string): string {
  if (ABSOLUTE_URL.test(href)) return href
  let path = ''
  for (const base of bases) {
    if (!base) continue
    if (ABSOLUTE_URL.test(base)) {
      // An absolute base restarts the chain — still as a directory.
      path = base.endsWith('/') ? base : `${base}/`
      continue
    }
    path += base.endsWith('/') ? base : `${base}/`
  }
  return normalizeRelativePath(path + href)
}

/** Collapses `./` and `seg/../` segments; keeps any query string or fragment intact. */
function normalizeRelativePath(path: string): string {
  if (ABSOLUTE_URL.test(path)) return path
  const suffixIndex = path.search(/[?#]/)
  const pathname = suffixIndex >= 0 ? path.slice(0, suffixIndex) : path
  const suffix = suffixIndex >= 0 ? path.slice(suffixIndex) : ''
  const out: string[] = []
  for (const segment of pathname.replace(/\\/g, '/').split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return out.join('/') + suffix
}

// ---------------------------------------------------------------------------
// Public parse function
// ---------------------------------------------------------------------------

export function parseManifest(xml: string): Manifest {
  let raw: unknown
  try {
    raw = PARSER.parse(xml)
  } catch (e) {
    throw new ManifestParseError(`Failed to parse imsmanifest.xml: ${e instanceof Error ? e.message : String(e)}`)
  }

  const manifest = child(raw, 'manifest')
  if (!isNode(manifest)) {
    throw new ManifestParseError('imsmanifest.xml does not contain a <manifest> root element.')
  }

  const organizationsNode = child(manifest, 'organizations')
  const resourcesNode = child(manifest, 'resources')
  const defaultOrgId = attr(organizationsNode, 'default')
  const resourceBases = [attr(manifest, 'base'), attr(resourcesNode, 'base')]

  const sequencingCollections = SEQUENCING.parseCollections(manifest)

  return {
    ...(defaultOrgId !== undefined ? { defaultOrganizationIdentifier: defaultOrgId } : {}),
    organizations: toArray(child(organizationsNode, 'organization')).map(parseOrganization),
    resources: toArray(child(resourcesNode, 'resource')).map((r) => parseResource(r, resourceBases)),
    metadata: parseMetadata(child(manifest, 'metadata')),
    ...(sequencingCollections !== undefined ? { sequencingCollections } : {}),
  }
}

// ---------------------------------------------------------------------------
// Element parsers
// ---------------------------------------------------------------------------

function parseMetadata(raw: unknown): ManifestMetadata {
  if (!isNode(raw)) return {}
  const schema = text(child(raw, 'schema'))
  const schemaVersion = text(child(raw, 'schemaversion'))
  const titleNode = child(child(child(raw, 'lom'), 'general'), 'title')
  const title = text(child(titleNode, 'langstring')) ?? text(child(titleNode, 'string'))
  return {
    ...(schema !== undefined ? { schema } : {}),
    ...(schemaVersion !== undefined ? { schemaVersion } : {}),
    ...(title !== undefined ? { title } : {}),
  }
}

function parseOrganization(raw: unknown): ManifestOrganization {
  const sequencing = SEQUENCING.parseFor(raw)
  return {
    identifier: attr(raw, 'identifier') ?? '',
    title: text(child(raw, 'title')) ?? '',
    ...(sequencing !== undefined ? { sequencing } : {}),
    items: toArray(child(raw, 'item')).map(parseItem),
  }
}

function parseItem(raw: unknown): ManifestItem {
  const isvisible = attr(raw, 'isvisible')?.toLowerCase() !== 'false'
  const identifierref = attr(raw, 'identifierref')
  const parameters = attr(raw, 'parameters')
  const launchData = parseLaunchData(raw)
  const sequencing = SEQUENCING.parseFor(raw)
  const completionThreshold = SEQUENCING.parseCompletionThreshold(raw)
  const hideLmsUi = SEQUENCING.parseHideLmsUi(raw)
  return {
    identifier: attr(raw, 'identifier') ?? '',
    title: text(child(raw, 'title')) ?? '',
    ...(identifierref !== undefined ? { identifierref } : {}),
    isvisible,
    ...(parameters ? { parameters } : {}),
    ...(Object.keys(launchData).length > 0 ? { launchData } : {}),
    ...(sequencing !== undefined ? { sequencing } : {}),
    ...(completionThreshold !== undefined ? { completionThreshold } : {}),
    ...(hideLmsUi !== undefined ? { hideLmsUi } : {}),
    children: toArray(child(raw, 'item')).map(parseItem),
  }
}

function parseLaunchData(raw: unknown): ManifestItemLaunchData {
  const dataFromLms = text(child(raw, 'datafromlms'))
  const masteryScore = text(child(raw, 'masteryscore'))
  const maxTimeAllowed = text(child(raw, 'maxtimeallowed'))
  const timeLimitAction = text(child(raw, 'timelimitaction'))
  const completionThreshold = parseCompletionThreshold(child(raw, 'completionthreshold'))
  const scaledPassingScore = parseScaledPassingScore(child(raw, 'sequencing'))
  const entries: [keyof ManifestItemLaunchData, string | undefined][] = [
    ['dataFromLms', dataFromLms],
    ['masteryScore', masteryScore],
    ['maxTimeAllowed', maxTimeAllowed],
    ['timeLimitAction', timeLimitAction],
    ['completionThreshold', completionThreshold],
    ['scaledPassingScore', scaledPassingScore],
  ]
  const data: ManifestItemLaunchData = {}
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') data[key] = value
  }
  return data
}

/**
 * 2004 3rd Edition writes the threshold as element text; 4th Edition uses
 * `completedByMeasure` + `minProgressMeasure` attributes, and only defines a
 * threshold when `completedByMeasure="true"`.
 */
function parseCompletionThreshold(raw: unknown): string | undefined {
  if (raw === undefined) return undefined
  const minProgress = attr(raw, 'minProgressMeasure')
  if (minProgress !== undefined || attr(raw, 'completedByMeasure') !== undefined) {
    if (attr(raw, 'completedByMeasure')?.toLowerCase() !== 'true') return undefined
    return minProgress ?? '1.0'
  }
  return text(raw)
}

function parseScaledPassingScore(sequencing: unknown): string | undefined {
  const primary = child(child(sequencing, 'objectives'), 'primaryObjective')
  if (attr(primary, 'satisfiedByMeasure')?.toLowerCase() !== 'true') return undefined
  return text(child(primary, 'minNormalizedMeasure')) ?? '1.0'
}

function parseResource(raw: unknown, inheritedBases: (string | undefined)[]): ManifestResource {
  const scormType = attr(raw, 'scormtype')?.toLowerCase()
  const normalised: 'sco' | 'asset' | undefined = scormType === 'sco' || scormType === 'asset' ? scormType : undefined
  const bases = [...inheritedBases, attr(raw, 'base')]
  const rawHref = attr(raw, 'href')
  const href = rawHref !== undefined ? resolveXmlBase(bases, rawHref) : undefined

  const files = toArray(child(raw, 'file'))
    .map((f) => attr(f, 'href'))
    .filter((h): h is string => Boolean(h))
    .map((h) => resolveXmlBase(bases, h))

  return {
    identifier: attr(raw, 'identifier') ?? '',
    type: attr(raw, 'type') ?? '',
    ...(href !== undefined ? { href } : {}),
    ...(normalised !== undefined ? { scormType: normalised } : {}),
    files,
  }
}
