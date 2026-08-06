/**
 * Parses a raw imsmanifest.xml string into the Manifest entity.
 *
 * Supports both SCORM 1.2 and SCORM 2004 manifests. Uses fast-xml-parser
 * for XML parsing — it handles namespaced attributes and arrays correctly
 * when configured with `isArray`.
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  Manifest,
  ManifestItem,
  ManifestMetadata,
  ManifestOrganization,
  ManifestResource,
} from '@/shared/types'

export class ManifestParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestParseError'
  }
}

// ---------------------------------------------------------------------------
// Internal raw XML shapes (what fast-xml-parser returns)
// ---------------------------------------------------------------------------

interface RawFile {
  '@_href': string
}

interface RawResource {
  '@_identifier': string
  '@_type': string
  '@_href'?: string
  '@_adlcp:scormtype'?: string
  '@_adlcp:scormType'?: string
  'file'?: RawFile | RawFile[]
}

interface RawItem {
  '@_identifier': string
  '@_identifierref'?: string
  '@_isvisible'?: string
  'title'?: string
  'item'?: RawItem | RawItem[]
}

interface RawOrganization {
  '@_identifier': string
  'title'?: string
  'item'?: RawItem | RawItem[]
}

interface RawMetadata {
  'schema'?: string
  'schemaversion'?: string
  'adlcp:location'?: string
  'imsmd:lom'?: { 'imsmd:general'?: { 'imsmd:title'?: { 'imsmd:langstring'?: string } } }
}

interface RawManifest {
  'manifest': {
    '@_identifier'?: string
    '@_default'?: string // default organization identifier on <organizations>
    'metadata'?: RawMetadata
    'organizations': {
      '@_default'?: string
      'organization'?: RawOrganization | RawOrganization[]
    }
    'resources': {
      'resource'?: RawResource | RawResource[]
    }
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
  isArray: (tagName) =>
    ['organization', 'item', 'resource', 'file', 'dependency'].includes(tagName),
  // Treat all text content as strings — prevents '1.2' being coerced to number.
  parseTagValue: false,
  // Trim whitespace from text values.
  trimValues: true,
  // Parse attribute values as strings (SCORM identifiers can look numeric).
  parseAttributeValue: false,
})

// ---------------------------------------------------------------------------
// Public parse function
// ---------------------------------------------------------------------------

export function parseManifest(xml: string): Manifest {
  let raw: RawManifest
  try {
    raw = PARSER.parse(xml) as RawManifest
  } catch (e) {
    throw new ManifestParseError(
      `Failed to parse imsmanifest.xml: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const manifest = raw?.manifest
  if (!manifest) {
    throw new ManifestParseError('imsmanifest.xml does not contain a <manifest> root element.')
  }

  const metadata = parseMetadata(manifest.metadata)

  const defaultOrgId: string | undefined =
    manifest.organizations?.['@_default'] ?? undefined

  const organizations: ManifestOrganization[] = toArray(
    manifest.organizations?.organization,
  ).map(parseOrganization)

  const resources: ManifestResource[] = toArray(
    manifest.resources?.resource,
  ).map(parseResource)

  return {
    ...(defaultOrgId !== undefined ? { defaultOrganizationIdentifier: defaultOrgId } : {}),
    organizations,
    resources,
    metadata,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function parseMetadata(raw: RawMetadata | undefined): ManifestMetadata {
  if (!raw) return {}
  const title = raw['imsmd:lom']?.['imsmd:general']?.['imsmd:title']?.['imsmd:langstring']
  return {
    ...(raw.schema !== undefined ? { schema: raw.schema } : {}),
    ...(raw.schemaversion !== undefined ? { schemaVersion: raw.schemaversion } : {}),
    ...(title !== undefined ? { title } : {}),
  }
}

function parseOrganization(raw: RawOrganization): ManifestOrganization {
  return {
    identifier: raw['@_identifier'] ?? '',
    title: raw.title ?? '',
    items: toArray(raw.item).map(parseItem),
  }
}

function parseItem(raw: RawItem): ManifestItem {
  const isvisible = raw['@_isvisible']?.toLowerCase() !== 'false'
  const identifierref = raw['@_identifierref']
  return {
    identifier: raw['@_identifier'] ?? '',
    title: typeof raw.title === 'string' ? raw.title : '',
    ...(identifierref !== undefined ? { identifierref } : {}),
    isvisible,
    children: toArray(raw.item).map(parseItem),
  }
}

function parseResource(raw: RawResource): ManifestResource {
  const scormType =
    raw['@_adlcp:scormtype'] ?? raw['@_adlcp:scormType']
  const normalised: 'sco' | 'asset' | undefined =
    scormType === 'sco' || scormType === 'asset' ? scormType : undefined
  const href = raw['@_href']

  const files: string[] = toArray(raw.file)
    .map((f) => f['@_href'])
    .filter(Boolean)

  return {
    identifier: raw['@_identifier'] ?? '',
    type: raw['@_type'] ?? '',
    ...(href !== undefined ? { href } : {}),
    ...(normalised !== undefined ? { scormType: normalised } : {}),
    files,
  }
}
