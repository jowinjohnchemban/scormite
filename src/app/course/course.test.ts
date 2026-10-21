/**
 * Course-session domain logic: flow navigation and SCORM 2004 navigation
 * request resolution, stored attempts, and the CMI status summary.
 */

import { describe, expect, it } from 'vitest'
import type { AttemptRecord } from '@/features/runtime'
import type { LaunchableItem } from '@/shared/types'
import { AttemptStore } from './AttemptStore'
import { CourseNavigator } from './CourseNavigator'
import { progressTone, summarizeCmi } from './summarizeCmi'
import { useCourseStore } from '@/app/state/courseStore'

function item(identifier: string): LaunchableItem {
  return {
    identifier,
    title: identifier.toUpperCase(),
    depth: 0,
    resourceIdentifier: `res-${identifier}`,
    scormType: 'sco',
    launchPath: `${identifier}/index.html`,
    launchData: {},
  }
}

describe('CourseNavigator', () => {
  const nav = new CourseNavigator([item('a'), item('b'), item('c')])

  it('steps through flow order', () => {
    expect(nav.first?.identifier).toBe('a')
    expect(nav.next('a')?.identifier).toBe('b')
    expect(nav.next('c')).toBeUndefined()
    expect(nav.previous('b')?.identifier).toBe('a')
    expect(nav.previous('a')).toBeUndefined()
    expect(nav.position('c')).toBe(3)
    expect(nav.position('zzz')).toBe(0)
  })

  it('resolves continue / previous, ending the course past the last item', () => {
    expect(nav.resolve({ request: 'continue' }, 'a')).toEqual({ kind: 'launch', itemId: 'b' })
    expect(nav.resolve({ request: 'continue' }, 'c')).toEqual({ kind: 'end' })
    expect(nav.resolve({ request: 'previous' }, 'b')).toEqual({ kind: 'launch', itemId: 'a' })
    expect(nav.resolve({ request: 'previous' }, 'a')).toEqual({ kind: 'none' })
  })

  it('resolves choice and jump targets, ignoring unknown ones', () => {
    expect(nav.resolve({ request: 'choice', target: 'c' }, 'a')).toEqual({ kind: 'launch', itemId: 'c' })
    expect(nav.resolve({ request: 'jump', target: 'b' }, 'c')).toEqual({ kind: 'launch', itemId: 'b' })
    expect(nav.resolve({ request: 'choice', target: 'nope' }, 'a')).toEqual({ kind: 'none' })
  })

  it('treats exitAll / abandonAll as the end, exit / abandon as no delivery', () => {
    expect(nav.resolve({ request: 'exitAll' }, 'b')).toEqual({ kind: 'end' })
    expect(nav.resolve({ request: 'abandonAll' }, 'b')).toEqual({ kind: 'end' })
    expect(nav.resolve({ request: 'exit' }, 'b')).toEqual({ kind: 'none' })
    expect(nav.resolve({ request: 'abandon' }, 'b')).toEqual({ kind: 'none' })
  })
})

describe('AttemptStore', () => {
  it('keeps one attempt per item until discarded or cleared', () => {
    const store = new AttemptStore()
    const record: AttemptRecord = { scormVersion: '1.2', data: { cmi: {} } }
    store.save('a', record)
    store.save('b', record)
    expect(store.get('a')).toBe(record)
    store.discard('a')
    expect(store.has('a')).toBe(false)
    store.clear()
    expect(store.has('b')).toBe(false)
  })
})

describe('summarizeCmi', () => {
  it('splits SCORM 1.2 lesson_status into completion and success', () => {
    expect(summarizeCmi({ 'cmi.core.lesson_status': 'passed', 'cmi.core.score.raw': '90' }, '1.2')).toMatchObject({
      completionStatus: 'passed',
      successStatus: 'passed',
      score: '90',
    })
    expect(summarizeCmi({ 'cmi.core.lesson_status': 'completed' }, '1.2').successStatus).toBe('unknown')
    expect(summarizeCmi({}, '1.2').completionStatus).toBe('not attempted')
  })

  it('prefers total time, falls back to session time, and hides zero durations', () => {
    expect(summarizeCmi({ 'cmi.core.total_time': '0000:00:00', 'cmi.core.session_time': '00:01:30' }, '1.2').time).toBe('00:01:30')
    expect(summarizeCmi({ 'cmi.total_time': 'PT0S' }, '2004').time).toBe('')
    expect(summarizeCmi({ 'cmi.total_time': 'PT2M' }, '2004').time).toBe('PT2M')
  })

  it('reads SCORM 2004 statuses and falls back to the scaled score', () => {
    expect(
      summarizeCmi(
        { 'cmi.completion_status': 'completed', 'cmi.success_status': 'failed', 'cmi.score.scaled': '0.4' },
        '2004',
      ),
    ).toMatchObject({ completionStatus: 'completed', successStatus: 'failed', score: '0.4' })
  })
})

describe('progressTone', () => {
  it('ranks success over completion', () => {
    const base = summarizeCmi({}, '2004')
    expect(progressTone(undefined)).toBe('not-started')
    expect(progressTone({ ...base, successStatus: 'passed', completionStatus: 'incomplete' })).toBe('passed')
    expect(progressTone({ ...base, successStatus: 'failed' })).toBe('failed')
    expect(progressTone({ ...base, completionStatus: 'completed' })).toBe('completed')
    expect(progressTone({ ...base, completionStatus: 'incomplete' })).toBe('in-progress')
    expect(progressTone(base)).toBe('not-started')
  })
})

describe('useCourseStore.go', () => {
  const items = [item('a'), item('b'), item('c')]

  it('resolves flow navigation to a launch request', () => {
    useCourseStore.getState().setCourse(items, false)
    useCourseStore.setState({ currentItemId: 'a' })
    useCourseStore.getState().go({ request: 'continue', mode: 'resume' })
    expect(useCourseStore.getState().pendingLaunch).toEqual({ itemId: 'b', mode: 'resume' })
  })

  it('hands sequenced navigation to the engine only when its look-ahead allows it', () => {
    const store = useCourseStore.getState()
    store.setCourse(items, true)
    useCourseStore.setState({ currentItemId: 'a' })
    store.setNavigation({ canContinue: false, canPrevious: false, choices: ['a', 'b'], hiddenControls: [] })

    useCourseStore.getState().go({ request: 'continue', mode: 'resume' })
    expect(useCourseStore.getState().pendingNavigation).toBeNull()
    expect(useCourseStore.getState().notice).toMatch(/sequencing rules/)

    useCourseStore.getState().go({ request: 'choice', targetId: 'c', mode: 'resume' })
    expect(useCourseStore.getState().pendingNavigation).toBeNull()

    useCourseStore.getState().go({ request: 'choice', targetId: 'b', mode: 'resume' })
    expect(useCourseStore.getState().pendingNavigation).toEqual({ request: 'choice', targetId: 'b', mode: 'resume' })
    expect(useCourseStore.getState().notice).toBeNull()
  })

  it('ignores navigation while a launch is in flight', () => {
    useCourseStore.getState().setCourse(items, false)
    useCourseStore.setState({ currentItemId: 'a', pendingLaunch: { itemId: 'c', mode: 'new' } })
    useCourseStore.getState().go({ request: 'continue', mode: 'resume' })
    expect(useCourseStore.getState().pendingLaunch).toEqual({ itemId: 'c', mode: 'new' })
  })
})
