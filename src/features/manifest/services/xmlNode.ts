/**
 * Namespace-prefix-agnostic access to fast-xml-parser output.
 *
 * Real-world manifests bind `adlcp` / `imsss` / `adlseq` / `adlnav` to
 * whatever prefix their authoring tool likes and are inconsistent about
 * attribute casing (`scormtype` vs `scormType`), so lookups match on the
 * case-insensitive local name.
 */

export type RawNode = Record<string, unknown>

export function isNode(value: unknown): value is RawNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `adlcp:scormType` → `scormtype`. */
export function localName(qualified: string): string {
  const colon = qualified.indexOf(':')
  return (colon >= 0 ? qualified.slice(colon + 1) : qualified).toLowerCase()
}

export function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** First child element whose local name matches `name`. */
export function child(node: unknown, name: string): unknown {
  if (!isNode(node)) return undefined
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue
    if (localName(key) === target) return value
  }
  return undefined
}

/**
 * Every child element whose local name matches `name`, across prefixes —
 * e.g. both `imsss:objectives` and `adlseq:objectives` — flattened.
 */
export function children(node: unknown, name: string): unknown[] {
  if (!isNode(node)) return []
  const target = name.toLowerCase()
  const out: unknown[] = []
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue
    if (localName(key) === target) out.push(...toArray(value))
  }
  return out
}

/**
 * Attribute value by local name. An exact unprefixed match wins so that,
 * e.g., `type` never resolves to a stray `xsi:type`.
 */
export function attr(node: unknown, name: string): string | undefined {
  if (!isNode(node)) return undefined
  const exact = node[`@_${name}`]
  if (typeof exact === 'string') return exact
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith('@_') || typeof value !== 'string') continue
    if (localName(key.slice(2)) === target) return value
  }
  return undefined
}

/** `"true"` / `"false"` attribute, or undefined when absent or malformed. */
export function boolAttr(node: unknown, name: string): boolean | undefined {
  const value = attr(node, name)?.trim().toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

/** Numeric attribute, or undefined when absent or not a number. */
export function numAttr(node: unknown, name: string): number | undefined {
  const value = attr(node, name)
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Text content of a simple element (plain string, or `#text` beside attributes). */
export function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (isNode(value) && typeof value['#text'] === 'string') return value['#text']
  return undefined
}
