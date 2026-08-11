/**
 * The plugin contract — the only types a plugin (built-in or third-party)
 * needs to know about. Deliberately dependency-free beyond React, lucide,
 * and shared types: plugins must never import from another feature, so
 * everything they can touch is declared here.
 */

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ValidationSeverity } from '@/shared/types'

/** Which dock region a plugin panel should default to. Mirrors the app's
 *  `DockRegion` without importing it (plugins can't reach into app). */
export type PluginRegion = 'left' | 'right' | 'bottom'

/** Static identity of a plugin. `id` is the stable key — unique per plugin. */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
}

/** A dock panel contributed by a plugin. Shape-compatible with the app's
 *  `PanelDef` so the app layer can register it without adaptation. */
export interface PluginPanelContribution {
  /** Id of the plugin that registered this panel (filled in by the host). */
  pluginId: string
  id: string
  title: string
  defaultRegion: PluginRegion
  defaultOpen: boolean
  icon: LucideIcon
  component: ComponentType
}

/** An invocable command contributed by a plugin (surfaced in the toolbar). */
export interface PluginCommandContribution {
  pluginId: string
  id: string
  title: string
  run: () => void
}

/**
 * Structural mirror of the runtime feature's `ApiCallResult`. Plugins must
 * not import from `features/runtime`, so the runtime validation contract is
 * re-declared here with `method` widened to `string`. The app layer adapts
 * contributions to the runtime feature's `RuntimeValidator` at wiring time.
 */
export interface PluginValidationResult {
  sessionId: string
  method: string
  element?: string
  value?: string
  returnValue: string
  durationMs: number
  errorCode?: string
  timestamp: number
}

/** Session state tracked for validators — currently just Commit visibility. */
export interface PluginValidationContext {
  sawCommit: boolean
}

/** A runtime validation rule contributed by a plugin. Shape-compatible with
 *  the runtime feature's `RuntimeValidator`. */
export interface PluginValidatorContribution {
  pluginId: string
  ruleId: string
  severity: ValidationSeverity
  check: (result: PluginValidationResult, ctx: PluginValidationContext) => string | null
}

/**
 * The capability surface handed to a plugin's `activate`. Every method adds
 * the contribution to the host registry; `pluginId` is stamped automatically.
 */
export interface PluginApi {
  registerPanel(panel: Omit<PluginPanelContribution, 'pluginId'>): void
  registerCommand(command: Omit<PluginCommandContribution, 'pluginId'>): void
  registerValidator(validator: Omit<PluginValidatorContribution, 'pluginId'>): void
}

/** A loadable plugin: manifest plus an activate hook that registers whatever
 *  panels, commands, and validators the plugin wants to contribute. */
export interface ScormitePlugin {
  manifest: PluginManifest
  activate(api: PluginApi): void
}
