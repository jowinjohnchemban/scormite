/**
 * PluginHost — the runtime registry for plugins.
 *
 * Owns three things:
 *  1. The set of registered plugins (manifest + activation status).
 *  2. The contributions those plugins made (panels, commands, validators).
 *  3. The `PluginApi` factory that stamps `pluginId` onto each contribution.
 *
 * The host is deliberately UI-free: panels surface through the app layer's
 * panel registry, commands through the toolbar, validators through the
 * runtime validation middleware. That wiring lives in `app/` because it
 * needs to touch features the plugins feature is not allowed to import.
 */

import { create } from 'zustand'
import type {
  PluginCommandContribution,
  PluginPanelContribution,
  PluginValidatorContribution,
  PluginApi,
  PluginManifest,
  ScormitePlugin,
} from '../types'

export interface RegisteredPlugin {
  manifest: PluginManifest
  active: boolean
}

interface PluginHostState {
  /** Registered plugins keyed by manifest id. */
  plugins: Record<string, RegisteredPlugin>
  /** Panel contributions across all active plugins, in registration order. */
  panels: PluginPanelContribution[]
  /** Command contributions across all active plugins. */
  commands: PluginCommandContribution[]
  /** Validator contributions across all active plugins. */
  validators: PluginValidatorContribution[]

  /** Register + activate a plugin. Idempotent per manifest id. */
  registerPlugin: (plugin: ScormitePlugin) => void
  /** True when a plugin with this id has been registered. */
  isRegistered: (id: string) => boolean
  /** Remove a plugin and everything it contributed. */
  unregisterPlugin: (id: string) => void
}

function makeApi(pluginId: string, set: (fn: (s: PluginHostState) => Partial<PluginHostState>) => void): PluginApi {
  return {
    registerPanel: (panel) =>
      set((s) => ({ panels: [...s.panels, { ...panel, pluginId }] })),
    registerCommand: (command) =>
      set((s) => ({ commands: [...s.commands, { ...command, pluginId }] })),
    registerValidator: (validator) =>
      set((s) => ({ validators: [...s.validators, { ...validator, pluginId }] })),
  }
}

export const usePluginHost = create<PluginHostState>((set, get) => ({
  plugins: {},
  panels: [],
  commands: [],
  validators: [],

  registerPlugin: (plugin) => {
    const { id } = plugin.manifest
    if (get().plugins[id]) return
    plugin.activate(makeApi(id, set))
    set((s) => ({
      plugins: { ...s.plugins, [id]: { manifest: plugin.manifest, active: true } },
    }))
  },

  isRegistered: (id) => get().plugins[id] !== undefined,

  unregisterPlugin: (id) =>
    set((s) => {
      const plugins = { ...s.plugins }
      delete plugins[id]
      return {
        plugins,
        panels: s.panels.filter((p) => p.pluginId !== id),
        commands: s.commands.filter((c) => c.pluginId !== id),
        validators: s.validators.filter((v) => v.pluginId !== id),
      }
    }),
}))
