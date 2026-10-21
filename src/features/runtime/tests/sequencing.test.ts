/**
 * SCORM 2004 sequencing through scorm-again's engine: configuration mapping,
 * engine-driven delivery, navigation availability, rule evaluation with
 * global objectives, and refused requests.
 */

import { afterEach, describe, expect, it } from 'vitest'
import type { ActivityDefinition } from '@/shared/types'
import { Scorm2004Adapter } from '../adapter/Scorm2004Adapter'
import { SequencingConfigBuilder } from '../adapter/sequencing/SequencingConfigBuilder'
import { runtimeEvents } from '../events/RuntimeEventEmitter'

const unsubscribers: (() => void)[] = []
afterEach(() => {
  for (const off of unsubscribers.splice(0)) off()
})

function leaf(id: string, extra: Partial<ActivityDefinition> = {}): ActivityDefinition {
  return { id, title: id.toUpperCase(), isVisible: true, children: [], ...extra }
}

function course(children: ActivityDefinition[], sequencing?: ActivityDefinition['sequencing']): ActivityDefinition {
  return { id: 'org', title: 'Course', isVisible: true, children, ...(sequencing ? { sequencing } : {}) }
}

function recordDeliveries(): string[] {
  const delivered: string[] = []
  unsubscribers.push(runtimeEvents.on('activity-delivered', (e) => delivered.push(e.activityId)))
  return delivered
}

/** Run the delivered SCO: initialize, apply values, terminate. */
function runSco(adapter: Scorm2004Adapter, values: Record<string, string>): void {
  adapter.prepareForDelivery()
  expect(adapter.initialize()).toBe('true')
  for (const [element, value] of Object.entries(values)) adapter.setValue(element, value)
  adapter.terminate()
}

describe('SequencingConfigBuilder', () => {
  it('maps IMS tokens and scales rollup percentages', () => {
    const { settings, warnings } = new SequencingConfigBuilder().build(
      course([leaf('a'), leaf('b')], {
        controls: { flow: true, choice: false, reorderChildren: true },
        rollupRules: [
          {
            action: 'completed',
            childActivitySet: 'atLeastPercent',
            minimumPercent: 0.5,
            conditionCombination: 'any',
            conditions: [{ condition: 'activityProgressKnown' }],
          },
        ],
        primaryObjective: { objectiveID: '', mapInfo: [] },
      }),
      undefined,
    )
    expect(warnings).toEqual([])
    const root = settings.activityTree
    expect(root?.sequencingControls).toMatchObject({ flow: true, choice: false, randomizeChildren: true })
    expect(root?.rollupRules?.rules[0]).toMatchObject({ minimumPercent: 50, conditions: [{ condition: 'progressKnown' }] })
    expect(root?.primaryObjective?.objectiveID).toBe('org#primary')
    expect(root?.children?.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('drops what the engine cannot evaluate faithfully, with a warning each', () => {
    const { settings, warnings } = new SequencingConfigBuilder().build(
      course([
        leaf('a', {
          sequencing: {
            rules: {
              preConditionRules: [{ action: 'exitAll', conditionCombination: 'all', conditions: [{ condition: 'always' }] }],
              exitConditionRules: [],
              postConditionRules: [],
            },
            rollupRules: [
              { action: 'satisfied', childActivitySet: 'all', conditionCombination: 'any', conditions: [{ condition: 'satisfied', operator: 'not' }] },
              { action: 'satisfied', childActivitySet: 'all', conditionCombination: 'any', conditions: [{ condition: 'satisfied' }, { condition: 'completed' }] },
              { action: 'satisfied', childActivitySet: 'all', conditionCombination: 'all', conditions: [{ condition: 'timeLimitExceeded' }] },
            ],
          },
        }),
      ]),
      { shared: { attemptLimit: 2 } },
    )
    expect(settings.activityTree?.children?.[0]?.sequencingRules).toBeUndefined()
    expect(settings.activityTree?.children?.[0]?.rollupRules).toBeUndefined()
    expect(warnings).toHaveLength(5)
    expect(warnings.join('\n')).toMatch(/"exitAll" is not valid here/)
    expect(warnings.join('\n')).toMatch(/"not" condition/)
    expect(warnings.join('\n')).toMatch(/with "any"/)
    expect(warnings.join('\n')).toMatch(/"timeLimitExceeded"/)
    expect(warnings.join('\n')).toMatch(/collection "shared"/)
  })
})

describe('Scorm2004Adapter with sequencing', () => {
  it('starts on the first activity and follows a SCO continue request', () => {
    const delivered = recordDeliveries()
    const adapter = new Scorm2004Adapter('s', undefined, { activityTree: course([leaf('a'), leaf('b'), leaf('c')]) })
    expect(adapter.isSequenced).toBe(true)
    expect(adapter.navigate('start')).toBe(true)
    expect(delivered).toEqual(['a'])

    runSco(adapter, { 'cmi.completion_status': 'completed', 'adl.nav.request': 'continue' })
    expect(delivered).toEqual(['a', 'b'])

    adapter.prepareForDelivery()
    expect(adapter.navigationState()).toMatchObject({ canContinue: true, canPrevious: true })
    expect(adapter.activityStatus('a')?.completionStatus).toBe('completed')
  })

  it('honours controlMode choice="false"', () => {
    recordDeliveries()
    const adapter = new Scorm2004Adapter('s', undefined, {
      activityTree: course([leaf('a'), leaf('b')], { controls: { flow: true, choice: false } }),
    })
    adapter.navigate('start')
    adapter.prepareForDelivery()
    expect(adapter.navigationState()?.choices).toEqual([])
    expect(adapter.navigate('choice', 'b')).toBe(false)
  })

  it('disables an activity until a global objective written by another is satisfied', () => {
    const delivered = recordDeliveries()
    const tree = course(
      [
        leaf('intro', {
          sequencing: {
            primaryObjective: {
              objectiveID: 'intro-obj',
              mapInfo: [{ targetObjectiveID: 'g-intro', writeSatisfiedStatus: true }],
            },
          },
        }),
        leaf('quiz', {
          sequencing: {
            rules: {
              preConditionRules: [
                {
                  action: 'disabled',
                  conditionCombination: 'all',
                  conditions: [{ condition: 'satisfied', operator: 'not', referencedObjective: 'gate' }],
                },
              ],
              exitConditionRules: [],
              postConditionRules: [],
            },
            objectives: [{ objectiveID: 'gate', mapInfo: [{ targetObjectiveID: 'g-intro', readSatisfiedStatus: true }] }],
          },
        }),
      ],
      { controls: { flow: true, choice: true } },
    )
    const adapter = new Scorm2004Adapter('s', undefined, { activityTree: tree })
    adapter.navigate('start')
    runSco(adapter, { 'cmi.success_status': 'failed' })
    expect(adapter.navigate('choice', 'quiz')).toBe(false)
    expect(delivered).toEqual(['intro'])

    // On a retry scorm-again seeds cmi.objectives with the previous attempt's
    // primary-objective status, and that entry wins at Terminate — so the SCO
    // must report the objective too (see ARCHITECTURE.md, known limitations).
    expect(adapter.navigate('choice', 'intro')).toBe(true)
    runSco(adapter, { 'cmi.success_status': 'passed', 'cmi.objectives.0.success_status': 'passed' })
    expect(adapter.navigate('choice', 'quiz')).toBe(true)
    expect(delivered.at(-1)).toBe('quiz')
  })

  it('reports a SCO request the rules refuse as a sequencing error', () => {
    const errors: string[] = []
    unsubscribers.push(runtimeEvents.on('sequencing-error', (e) => errors.push(e.message)))
    recordDeliveries()
    const adapter = new Scorm2004Adapter('s', undefined, { activityTree: course([leaf('a'), leaf('b')]) })
    adapter.navigate('start')
    runSco(adapter, { 'adl.nav.request': 'previous' })
    expect(errors.some((m) => /"previous"/.test(m))).toBe(true)
  })

  it('announces the end of the session on exitAll', () => {
    const ends: string[] = []
    unsubscribers.push(runtimeEvents.on('sequencing-session-end', (e) => ends.push(e.reason)))
    recordDeliveries()
    const adapter = new Scorm2004Adapter('s', undefined, { activityTree: course([leaf('a'), leaf('b')]) })
    adapter.navigate('start')
    runSco(adapter, { 'adl.nav.request': 'exitAll' })
    expect(ends).toEqual(['exitAll'])
    expect(adapter.navigationState()?.canContinue ?? false).toBe(false)
  })
})

describe('Scorm2004Adapter without sequencing', () => {
  it('keeps forwarding navigation requests after the SCO re-initializes', () => {
    const requests: string[] = []
    unsubscribers.push(runtimeEvents.on('navigation-request', (e) => requests.push(e.request)))
    const adapter = new Scorm2004Adapter('s')
    expect(adapter.isSequenced).toBe(false)
    adapter.initialize()
    adapter.terminate()
    // A second Initialize resets scorm-again, which clears api.on listeners.
    adapter.initialize()
    adapter.setValue('adl.nav.request', 'continue')
    adapter.terminate()
    expect(requests).toEqual(['continue'])
  })
})
