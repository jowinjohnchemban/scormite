/**
 * The assessment a SCO reports through the data model — interactions (quiz
 * questions and answers), objectives, and the score — gathered from the flat
 * CMI into records, for SCORM 1.2 and 2004 alike.
 */

export interface InteractionRecord {
  index: number
  id: string
  type: string
  description?: string
  correctResponses: string[]
  learnerResponse: string
  result: string
  weighting?: string
  latency?: string
  time?: string
  objectives: string[]
}

export interface ObjectiveRecord {
  index: number
  id: string
  status: Record<string, string>
  score: Record<string, string>
  description?: string
}

export interface AssessmentData {
  score: Record<string, string>
  interactions: InteractionRecord[]
  objectives: ObjectiveRecord[]
}

/** `{prefix}.{n}.{rest}` entries grouped by n, e.g. cmi.interactions.0.id → {0: {id}}. */
function grouped(cmi: Record<string, string>, prefix: string): Map<number, Record<string, string>> {
  const groups = new Map<number, Record<string, string>>()
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)\\.(.+)$`)
  for (const [key, value] of Object.entries(cmi)) {
    const match = pattern.exec(key)
    if (!match) continue
    const index = Number(match[1])
    const group = groups.get(index) ?? {}
    group[match[2]!] = value
    groups.set(index, group)
  }
  return new Map([...groups].sort(([a], [b]) => a - b))
}

/** Values of `{field}.{n}.{key}` in order, e.g. correct_responses.0.pattern. */
function listed(group: Record<string, string>, field: string, key: string): string[] {
  return Object.entries(group)
    .map(([name, value]) => [new RegExp(`^${field}\\.(\\d+)\\.${key}$`).exec(name)?.[1], value] as const)
    .filter((entry): entry is readonly [string, string] => entry[0] !== undefined)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => value)
}

const optional = (key: string, value: string | undefined) => (value ? { [key]: value } : {})

export function assessmentFromCmi(cmi: Record<string, string>): AssessmentData {
  const score = Object.fromEntries(
    Object.entries(cmi)
      .filter(([key]) => /^cmi\.(core\.)?score\.(raw|min|max|scaled)$/.test(key) && cmi[key] !== '')
      .map(([key, value]) => [key.replace(/^cmi\.(core\.)?score\./, ''), value]),
  )

  const interactions = [...grouped(cmi, 'cmi.interactions')].map(([index, group]) => ({
    index,
    id: group['id'] ?? '',
    type: group['type'] ?? '',
    ...optional('description', group['description']),
    correctResponses: listed(group, 'correct_responses', 'pattern'),
    // SCORM 2004 learner_response, SCORM 1.2 student_response.
    learnerResponse: group['learner_response'] ?? group['student_response'] ?? '',
    result: group['result'] ?? '',
    ...optional('weighting', group['weighting']),
    ...optional('latency', group['latency']),
    ...optional('time', group['timestamp'] ?? group['time']),
    objectives: listed(group, 'objectives', 'id'),
  }))

  const objectives = [...grouped(cmi, 'cmi.objectives')].map(([index, group]) => ({
    index,
    id: group['id'] ?? '',
    status: Object.fromEntries(
      ['status', 'success_status', 'completion_status', 'progress_measure']
        .filter((key) => group[key])
        .map((key) => [key, group[key]!]),
    ),
    score: Object.fromEntries(
      Object.entries(group)
        .filter(([key, value]) => key.startsWith('score.') && value !== '')
        .map(([key, value]) => [key.slice('score.'.length), value]),
    ),
    ...optional('description', group['description']),
  }))

  return { score, interactions, objectives }
}
