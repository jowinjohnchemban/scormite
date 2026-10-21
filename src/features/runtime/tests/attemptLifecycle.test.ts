/**
 * LMS-side adapter behavior against real scorm-again: seeding manifest
 * launch data, exporting an attempt, resuming it in a fresh adapter, and
 * forwarding SCORM 2004 navigation requests.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Scorm12Adapter } from '../adapter/Scorm12Adapter'
import { Scorm2004Adapter } from '../adapter/Scorm2004Adapter'
import { runtimeEvents } from '../events/RuntimeEventEmitter'
import type { NavigationRequestEvent } from '../types'

const unsubscribers: (() => void)[] = []
afterEach(() => {
  for (const off of unsubscribers.splice(0)) off()
})

describe('Scorm12Adapter — launch data and resume', () => {
  it('seeds manifest launch data and LMS credit before Initialize', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({
      dataFromLms: 'mode=review',
      masteryScore: '80',
      maxTimeAllowed: '00:30:00',
      timeLimitAction: 'exit,message',
    })
    expect(adapter.initialize()).toBe('true')
    expect(adapter.getValue('cmi.launch_data')).toBe('mode=review')
    expect(adapter.getValue('cmi.student_data.mastery_score')).toBe('80')
    expect(adapter.getValue('cmi.student_data.max_time_allowed')).toBe('00:30:00')
    expect(adapter.getValue('cmi.student_data.time_limit_action')).toBe('exit,message')
    expect(adapter.getValue('cmi.core.credit')).toBe('credit')
  })

  it('skips malformed manifest values without dropping the rest', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({ masteryScore: 'eighty', dataFromLms: 'ok' })
    adapter.initialize()
    expect(adapter.getValue('cmi.launch_data')).toBe('ok')
  })

  it('applies mastery score at Finish once credit is seeded', () => {
    const adapter = new Scorm12Adapter('s1')
    adapter.seedLaunchData({ masteryScore: '80' })
    adapter.initialize()
    adapter.setValue('cmi.core.score.raw', '65')
    adapter.terminate()
    expect(adapter.getFlattenedCmi()['cmi.core.lesson_status']).toBe('failed')
  })

  it('resumes a suspended attempt with entry=resume and accumulated time', () => {
    const first = new Scorm12Adapter('s1')
    first.initialize()
    first.setValue('cmi.core.lesson_location', 'page-3')
    first.setValue('cmi.core.lesson_status', 'incomplete')
    first.setValue('cmi.suspend_data', 'state')
    first.setValue('cmi.core.exit', 'suspend')
    first.setValue('cmi.core.session_time', '00:02:00')
    first.terminate()
    const record = first.exportAttempt()
    expect(record.scormVersion).toBe('1.2')

    const second = new Scorm12Adapter('s1')
    second.restoreAttempt(record)
    expect(second.initialize()).toBe('true')
    expect(second.getValue('cmi.core.entry')).toBe('resume')
    expect(second.getValue('cmi.core.lesson_location')).toBe('page-3')
    expect(second.getValue('cmi.suspend_data')).toBe('state')
    expect(second.getValue('cmi.core.lesson_status')).toBe('incomplete')
    expect(second.getValue('cmi.core.total_time')).toBe('00:02:00')
  })

  it('does not mark entry=resume after a normal exit', () => {
    const first = new Scorm12Adapter('s1')
    first.initialize()
    first.setValue('cmi.core.lesson_status', 'completed')
    first.terminate()

    const second = new Scorm12Adapter('s1')
    second.restoreAttempt(first.exportAttempt())
    second.initialize()
    expect(second.getValue('cmi.core.entry')).toBe('')
  })

  it('ignores a record from another SCORM version', () => {
    const other = new Scorm2004Adapter('s1')
    other.initialize()
    other.setValue('cmi.location', 'x')
    other.terminate()

    const adapter = new Scorm12Adapter('s1')
    adapter.restoreAttempt(other.exportAttempt())
    adapter.initialize()
    expect(adapter.getValue('cmi.core.lesson_location')).toBe('')
  })
})

describe('Scorm2004Adapter — launch data, resume, navigation', () => {
  it('seeds completion threshold, scaled passing score, and launch data', () => {
    const adapter = new Scorm2004Adapter('s1')
    adapter.seedLaunchData({
      dataFromLms: 'seed',
      completionThreshold: '0.75',
      scaledPassingScore: '0.6',
    })
    adapter.initialize()
    expect(adapter.getValue('cmi.launch_data')).toBe('seed')
    expect(adapter.getValue('cmi.completion_threshold')).toBe('0.75')
    expect(adapter.getValue('cmi.scaled_passing_score')).toBe('0.6')
  })

  it('resumes interactions, objectives, and suspend_data', () => {
    const first = new Scorm2004Adapter('s1')
    first.initialize()
    first.setValue('cmi.location', 'p3')
    first.setValue('cmi.suspend_data', 'sd')
    first.setValue('cmi.objectives.0.id', 'obj-1')
    first.setValue('cmi.interactions.0.id', 'q1')
    first.setValue('cmi.interactions.0.type', 'true-false')
    first.setValue('cmi.exit', 'suspend')
    first.setValue('cmi.session_time', 'PT2M')
    first.terminate()

    const second = new Scorm2004Adapter('s1')
    second.restoreAttempt(first.exportAttempt())
    second.initialize()
    expect(second.getValue('cmi.entry')).toBe('resume')
    expect(second.getValue('cmi.location')).toBe('p3')
    expect(second.getValue('cmi.suspend_data')).toBe('sd')
    expect(second.getValue('cmi.objectives._count')).toBe('1')
    expect(second.getValue('cmi.interactions._count')).toBe('1')
    expect(second.getValue('cmi.total_time')).toBe('PT2M')
  })

  it('forwards adl.nav.request as a navigation-request event', () => {
    const events: NavigationRequestEvent[] = []
    unsubscribers.push(runtimeEvents.on('navigation-request', (e) => events.push(e)))

    const next = new Scorm2004Adapter('s1')
    next.initialize()
    next.setValue('adl.nav.request', 'continue')
    next.terminate()

    const choice = new Scorm2004Adapter('s2')
    choice.initialize()
    choice.setValue('adl.nav.request', '{target=item-2}choice')
    choice.terminate()

    expect(events).toEqual([
      { sessionId: 's1', request: 'continue' },
      { sessionId: 's2', request: 'choice', target: 'item-2' },
    ])
  })
})
