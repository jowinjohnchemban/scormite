/**
 * Public surface of the "settings" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 *
 * Milestone 11 fills this in with runtime profiles: the profile catalog, the
 * persisted choice, and the toolbar menu that switches it. Theme and editor
 * preferences land here in later milestones.
 */

export {
  DEFAULT_RUNTIME_PROFILE_ID,
  getRuntimeProfile,
  RUNTIME_PROFILES,
  RUNTIME_PROFILE_IDS,
  type RuntimeProfile,
  type RuntimeProfileId,
} from './profiles/runtimeProfiles'
export { SETTINGS_STORAGE_KEY, useActiveProfile, useSettingsStore } from './state/settingsStore'
export { ProfileMenu } from './components/ProfileMenu'
