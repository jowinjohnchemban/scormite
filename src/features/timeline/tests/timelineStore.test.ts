import { beforeEach, describe, expect, it } from 'vitest'
import { useTimelineStore } from '../state/timelineStore'

beforeEach(() => {
  useTimelineStore.getState().reset()
})

describe('timelineStore', () => {
  it('captures a snapshot and diffs it against the previous one', () => {
    const store = useTimelineStore.getState()
    store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
    store.captureSnapshot({
      timestamp: 2,
      sessionId: 's1',
      data: { 'cmi.location': 'page2', 'cmi.score.raw': '40' },
    })

    const { snapshots } = useTimelineStore.getState()
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]?.changedPaths).toEqual(['cmi.location'])
    expect(snapshots[1]?.changedPaths.sort()).toEqual(['cmi.location', 'cmi.score.raw'])
  })

  it('ignores snapshots that did not change anything', () => {
    const store = useTimelineStore.getState()
    store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
    store.captureSnapshot({ timestamp: 2, sessionId: 's1', data: { 'cmi.location': 'intro' } })

    const { snapshots } = useTimelineStore.getState()
    expect(snapshots).toHaveLength(1)
  })

  it('scrubTo pins the cursor within bounds', () => {
    const store = useTimelineStore.getState()
    store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
    store.captureSnapshot({ timestamp: 2, sessionId: 's1', data: { 'cmi.location': 'next' } })

    useTimelineStore.getState().scrubTo(1)
    expect(useTimelineStore.getState().cursor).toBe(1)

    useTimelineStore.getState().scrubTo(99)
    expect(useTimelineStore.getState().cursor).toBeNull()

    useTimelineStore.getState().scrubTo(-3)
    expect(useTimelineStore.getState().cursor).toBeNull()
  })

  it('resumeLive clears the cursor back to live mode', () => {
    const store = useTimelineStore.getState()
    store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
    useTimelineStore.getState().scrubTo(0)
    useTimelineStore.getState().resumeLive()

    expect(useTimelineStore.getState().cursor).toBeNull()
  })

  it('reset clears snapshots and the cursor', () => {
    const store = useTimelineStore.getState()
    store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
    useTimelineStore.getState().scrubTo(0)
    useTimelineStore.getState().reset()

    const state = useTimelineStore.getState()
    expect(state.snapshots).toHaveLength(0)
    expect(state.cursor).toBeNull()
  })
})
