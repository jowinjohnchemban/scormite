/**
 * App-layer hook that keeps the Advanced Mode dock's panel registry in sync
 * with the plugin host.
 *
 * Lives in app/ because it joins the plugin contract with the app's own
 * `PanelDef` shape; the plugins feature itself stays UI-surface-agnostic.
 */

import { useEffect } from 'react'
import { usePanelRegistry, type PanelDef } from '@/app/layout/PanelRegistry'
import { usePluginHost, type PluginPanelContribution } from '@/features/plugins'
import { registerBuiltinPlugins } from './pluginHostBridge'

/** Plugin regions are the same string union as dock regions, so the mapping
 *  is a straight shape copy — no adaptation logic to drift. */
function toPanelDef(panel: PluginPanelContribution): PanelDef {
  return {
    id: panel.id,
    title: panel.title,
    defaultRegion: panel.defaultRegion,
    defaultOpen: panel.defaultOpen,
    component: panel.component,
    icon: panel.icon,
  }
}

/**
 * Registers built-in plugins (idempotent) and keeps the dock's panel
 * registry in sync with the host. Registration order: plugins activate and
 * contribute synchronously, so the first sync already sees their panels;
 * the subscription covers plugins registered later.
 */
export function useRegisterPluginPanels(): void {
  const register = usePanelRegistry((s) => s.register)
  useEffect(() => {
    registerBuiltinPlugins()
    const sync = (panels: PluginPanelContribution[]): void => {
      for (const panel of panels) register(toPanelDef(panel))
    }
    sync(usePluginHost.getState().panels)
    return usePluginHost.subscribe((state) => sync(state.panels))
  }, [register])
}
