/**
 * Normalization for scorm-again's flattened CMI output.
 *
 * `getFlattenedCMI()` is `flatten(renderCMIToJSONObject())`, and `flatten` can
 * emit non-string leaf values: numbers, booleans, null/undefined, and empty
 * objects/arrays. Real packages (e.g. Articulate Storyline output) do hit
 * these paths, and React cannot render such values raw — an empty object `{}`
 * reaches a `<span>` and throws "Objects are not valid as a React child".
 *
 * We coerce every leaf to a string at the adapter boundary so the adapter
 * contract `getFlattenedCmi(): Record<string, string>` actually holds.
 */

function normalizeValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    // An empty collection (no interactions or objectives yet) holds no data;
    // show it as empty rather than as a literal "{}".
    return Object.keys(value).length === 0 ? '' : JSON.stringify(value)
  }
  return String(value)
}

/** Coerces every leaf value of a flattened CMI map to a string. */
export function normalizeFlattenedCmi(
  raw: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(raw)) {
    result[key] = normalizeValue(raw[key])
  }
  return result
}
