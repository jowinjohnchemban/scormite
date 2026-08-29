/**
 * Common CMI path utilities used across runtime middleware.
 */

const SCORE_PATHS = ['cmi.core.score.raw', 'cmi.score.raw']

/** SCORM 1.2 and 2004 both spell the score element `.score.raw`. */
export function isScorePath(element: string | undefined): boolean {
  return element !== undefined && (SCORE_PATHS.includes(element) || element.endsWith('.score.raw'))
}
