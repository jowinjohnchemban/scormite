import { beforeEach, describe, expect, it } from 'vitest'
import { useInspectorStore } from './inspectorStore'

beforeEach(() => {
  useInspectorStore.getState().reset()
})

describe('inspectorStore replay mode', () => {
  it('showSnapshot pins the inspector to historical data', () => {
    useInspectorStore.getState().showSnapshot(
      { 'cmi.location': 'page2' },
      ['cmi.location'],
    )

    const state = useInspectorStore.getState()
    expect(state.isReplay).toBe(true)
    expect(state.values).toEqual({ 'cmi.location': 'page2' })
    expect(state.changedPaths).toEqual(['cmi.location'])
  })

  it('showLive leaves replay mode without touching values', () => {
    useInspectorStore.getState().showSnapshot({ 'cmi.location': 'page2' }, ['cmi.location'])
    useInspectorStore.getState().showLive()

    const state = useInspectorStore.getState()
    expect(state.isReplay).toBe(false)
    expect(state.values).toEqual({ 'cmi.location': 'page2' })
  })

  it('updateValues keeps diff highlighting in live mode', () => {
    useInspectorStore.getState().setBaseline({ 'cmi.location': 'intro' })
    useInspectorStore.getState().updateValues({ 'cmi.location': 'next' })

    expect(useInspectorStore.getState().isReplay).toBe(false)
    expect(useInspectorStore.getState().changedPaths).toEqual(['cmi.location'])
  })

  it('reset exits replay mode', () => {
    useInspectorStore.getState().showSnapshot({ 'cmi.location': 'page2' }, ['cmi.location'])
    useInspectorStore.getState().reset()

    const state = useInspectorStore.getState()
    expect(state.isReplay).toBe(false)
    expect(state.values).toEqual({})
  })
})
