import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import {
  DEFAULT_RUNTIME_PROFILE_ID,
  getRuntimeProfile,
} from '../profiles/runtimeProfiles'
import {
  SETTINGS_STORAGE_KEY,
  useActiveProfile,
  useSettingsStore,
} from '../state/settingsStore'

// The store persists to localStorage; reset both so tests never leak a
// profile choice across files. Rehydrate after clearing so the in-memory
// state matches the (now empty) storage.
beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
})

describe('useSettingsStore', () => {
  it('defaults to the strict-adl profile', () => {
    expect(useSettingsStore.getState().activeProfileId).toBe(DEFAULT_RUNTIME_PROFILE_ID)
  })

  it('setProfile switches the active profile', () => {
    useSettingsStore.getState().setProfile('moodle')
    expect(useSettingsStore.getState().activeProfileId).toBe('moodle')
  })

  it('persists the choice to localStorage', () => {
    useSettingsStore.getState().setProfile('scorm-cloud')

    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ state: { activeProfileId: 'scorm-cloud' } })
  })

  it('rehydrates a persisted choice on a fresh store instance', async () => {
    // Simulate a reload: memory is back at the default, and storage holds a
    // previously chosen profile. setState before writing storage, since the
    // persist middleware re-writes storage on every state change.
    useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { activeProfileId: 'cornerstone' } }),
    )

    await useSettingsStore.persist.rehydrate()

    expect(useSettingsStore.getState().activeProfileId).toBe('cornerstone')
  })

  it('falls back to the default when a stale id is persisted', async () => {
    useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { activeProfileId: 'from-a-future-version' } }),
    )

    await useSettingsStore.persist.rehydrate()

    // The id itself persists (zustand doesn't validate), but consumers must
    // never crash on it — getRuntimeProfile's fallback covers that.
    expect(useSettingsStore.getState().activeProfileId).toBe('from-a-future-version')
    expect(getRuntimeProfile(useSettingsStore.getState().activeProfileId).id).toBe(
      DEFAULT_RUNTIME_PROFILE_ID,
    )
  })
})

describe('useActiveProfile', () => {
  it('returns the full profile for the active id', () => {
    useSettingsStore.getState().setProfile('canvas')

    const { result } = renderHook(() => useActiveProfile())

    expect(result.current.id).toBe('canvas')
    expect(result.current.label).toBe('Canvas')
  })
})
