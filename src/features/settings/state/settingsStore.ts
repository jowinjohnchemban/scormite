/**
 * App settings owned by this feature. Milestone 11 fills in the active
 * runtime profile; theme and editor prefs land here in later milestones.
 *
 * Persisted to localStorage via zustand's `persist` middleware — the same
 * convention as the dock layout (see `app/layout/dockStorage.ts`). The
 * design doc mentions IndexedDB for settings; that becomes worth the move
 * once settings grow past a handful of scalars, and nothing here assumes a
 * storage backend.
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_RUNTIME_PROFILE_ID,
  getRuntimeProfile,
  type RuntimeProfile,
  type RuntimeProfileId,
} from '../profiles/runtimeProfiles'

/** localStorage key — keep stable; persisted values survive on change. */
export const SETTINGS_STORAGE_KEY = 'scormite-settings'

interface SettingsState {
  activeProfileId: RuntimeProfileId
  setProfile: (id: RuntimeProfileId) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeProfileId: DEFAULT_RUNTIME_PROFILE_ID,
      setProfile: (activeProfileId) => set({ activeProfileId }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the profile choice is persisted — functions never are.
      partialize: (state) => ({ activeProfileId: state.activeProfileId }),
    },
  ),
)

/**
 * The full profile object for the active profile. Components read this so
 * they never juggle the id plus a registry lookup.
 */
export function useActiveProfile(): RuntimeProfile {
  const id = useSettingsStore((s) => s.activeProfileId)
  return getRuntimeProfile(id)
}
