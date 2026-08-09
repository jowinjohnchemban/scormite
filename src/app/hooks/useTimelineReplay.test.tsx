import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTimelineReplay } from './useTimelineReplay'
import { useTimelineStore } from '@/features/timeline'
import { useInspectorStore } from '@/features/inspector'
import { ScormRuntimeAdapter, useRuntimeStore } from '@/features/runtime'

function seedSnapshots(): void {
  const store = useTimelineStore.getState()
  store.captureSnapshot({ timestamp: 1, sessionId: 's1', data: { 'cmi.location': 'intro' } })
  store.captureSnapshot({ timestamp: 2, sessionId: 's1', data: { 'cmi.location': 'page2' } })
}

function stubAdapter(liveCmi: Record<string, string>): ScormRuntimeAdapter {
  return { sessionId: 's1', getFlattenedCmi: () => liveCmi } as unknown as ScormRuntimeAdapter
}

afterEach(() => {
  useTimelineStore.getState().reset()
  useInspectorStore.getState().reset()
  useRuntimeStore.getState().reset()
})

beforeEach(() => {
  useTimelineStore.getState().reset()
  useInspectorStore.getState().reset()
  useRuntimeStore.getState().reset()
})

describe('useTimelineReplay', () => {
  it('shows the scrubbed snapshot in the inspector while replaying', () => {
    seedSnapshots()
    renderHook(() => useTimelineReplay())

    act(() => useTimelineStore.getState().scrubTo(0))

    const inspector = useInspectorStore.getState()
    expect(inspector.isReplay).toBe(true)
    expect(inspector.values).toEqual({ 'cmi.location': 'intro' })
    expect(inspector.changedPaths).toEqual(['cmi.location'])
  })

  it('resume live re-syncs the inspector to current adapter state', () => {
    seedSnapshots()
    useRuntimeStore.getState().setAdapter(stubAdapter({ 'cmi.location': 'page3' }), '1.2')
    renderHook(() => useTimelineReplay())

    act(() => useTimelineStore.getState().scrubTo(0))
    expect(useInspectorStore.getState().isReplay).toBe(true)

    act(() => useTimelineStore.getState().resumeLive())

    const inspector = useInspectorStore.getState()
    expect(inspector.isReplay).toBe(false)
    expect(inspector.values).toEqual({ 'cmi.location': 'page3' })
  })

  it('does not disturb the inspector while following live state', () => {
    useInspectorStore.getState().setBaseline({ 'cmi.location': 'intro' })
    renderHook(() => useTimelineReplay())

    act(() =>
      useTimelineStore.getState().captureSnapshot({
        timestamp: 2,
        sessionId: 's1',
        data: { 'cmi.location': 'page2' },
      }),
    )

    const inspector = useInspectorStore.getState()
    expect(inspector.isReplay).toBe(false)
    expect(inspector.values).toEqual({ 'cmi.location': 'intro' })
  })

  it('clears the cursor when a new package resets the timeline', () => {
    seedSnapshots()
    renderHook(() => useTimelineReplay())

    act(() => useTimelineStore.getState().scrubTo(1))
    expect(useInspectorStore.getState().isReplay).toBe(true)

    act(() => useTimelineStore.getState().reset())

    expect(useInspectorStore.getState().isReplay).toBe(false)
  })
})
