/**
 * Public surface of the "plugins" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 *
 * Milestone 13 fills this in with the plugin system: the plugin contract
 * (types), the host registry that owns plugins and their contributions, and
 * the built-in sample plugin that proves the surface works end-to-end.
 */

export type {
  PluginApi,
  PluginCommandContribution,
  PluginManifest,
  PluginPanelContribution,
  PluginRegion,
  PluginValidationContext,
  PluginValidationResult,
  PluginValidatorContribution,
  ScormitePlugin,
} from './types'
export { usePluginHost, type RegisteredPlugin } from './registry/PluginHost'
export { samplePlugin } from './builtin/samplePlugin'
