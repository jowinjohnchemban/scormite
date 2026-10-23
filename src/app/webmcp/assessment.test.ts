/**
 * Interactions, objectives, and score gathered from the flat CMI, for SCORM
 * 1.2 and 2004.
 */

import { describe, expect, it } from 'vitest'
import { assessmentFromCmi } from './assessment'

describe('assessmentFromCmi', () => {
  it('reads SCORM 2004 interactions, objectives, and the score', () => {
    const data = assessmentFromCmi({
      'cmi.score.raw': '80',
      'cmi.score.scaled': '0.8',
      'cmi.score.min': '',
      'cmi.interactions.1.id': 'q2',
      'cmi.interactions.1.type': 'true-false',
      'cmi.interactions.1.learner_response': 'false',
      'cmi.interactions.1.result': 'incorrect',
      'cmi.interactions.1.correct_responses.0.pattern': 'true',
      'cmi.interactions.0.id': 'q1',
      'cmi.interactions.0.type': 'choice',
      'cmi.interactions.0.description': 'Pick the capital of France',
      'cmi.interactions.0.correct_responses.1.pattern': 'b',
      'cmi.interactions.0.correct_responses.0.pattern': 'a',
      'cmi.interactions.0.learner_response': 'a',
      'cmi.interactions.0.result': 'correct',
      'cmi.interactions.0.weighting': '1',
      'cmi.interactions.0.objectives.0.id': 'obj-geo',
      'cmi.objectives.0.id': 'obj-geo',
      'cmi.objectives.0.success_status': 'passed',
      'cmi.objectives.0.completion_status': 'completed',
      'cmi.objectives.0.score.scaled': '1',
    })
    expect(data.score).toEqual({ raw: '80', scaled: '0.8' })
    expect(data.interactions).toEqual([
      {
        index: 0,
        id: 'q1',
        type: 'choice',
        description: 'Pick the capital of France',
        correctResponses: ['a', 'b'],
        learnerResponse: 'a',
        result: 'correct',
        weighting: '1',
        objectives: ['obj-geo'],
      },
      {
        index: 1,
        id: 'q2',
        type: 'true-false',
        correctResponses: ['true'],
        learnerResponse: 'false',
        result: 'incorrect',
        objectives: [],
      },
    ])
    expect(data.objectives).toEqual([
      {
        index: 0,
        id: 'obj-geo',
        status: { success_status: 'passed', completion_status: 'completed' },
        score: { scaled: '1' },
      },
    ])
  })

  it("reads SCORM 1.2's student_response and core score", () => {
    const data = assessmentFromCmi({
      'cmi.core.score.raw': '50',
      'cmi.interactions.0.id': 'q1',
      'cmi.interactions.0.student_response': 'c',
      'cmi.interactions.0.time': '10:00:00',
      'cmi.objectives.0.id': 'o1',
      'cmi.objectives.0.status': 'failed',
    })
    expect(data.score).toEqual({ raw: '50' })
    expect(data.interactions[0]).toMatchObject({ id: 'q1', learnerResponse: 'c', time: '10:00:00' })
    expect(data.objectives[0]).toMatchObject({ id: 'o1', status: { status: 'failed' } })
  })
})
