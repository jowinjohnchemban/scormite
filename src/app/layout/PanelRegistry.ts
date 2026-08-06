import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type React from 'react'

export type PanelRegion = 'left' | 'center' | 'right' | 'bottom'

export interface PanelDef {
  id: string
  title: string
  region: PanelRegion
  /** The React component to render inside the panel. */
  component: React.ComponentType
  /** Whether the panel is open by default. */
  defaultOpen: boolean
}

interface PanelRegistryState {
  /** All registered panel definitions. */
  panels: PanelDef[]
  /** IDs of currently open panels. */
  openIds: string[]
  /** Active tab per region (for regions that use a tab strip). */
  activeTab: Record<string, string>

  register: (panel: PanelDef) => void
  unregister: (id: string) => void
  open: (id: string) => void
  close: (id: string) => void
  toggle: (id: string) => void
  setActiveTab: (region: PanelRegion, id: string) => void
}

export const usePanelRegistry = create<PanelRegistryState>()(
  persist(
    (set, get) => ({
      panels: [],
      openIds: [],
      activeTab: {},

      register: (panel) => {
        set((s) => {
          if (s.panels.find((p) => p.id === panel.id)) return {}
          return {
            panels: [...s.panels, panel],
            openIds: panel.defaultOpen ? [...s.openIds, panel.id] : s.openIds,
          }
        })
      },

      unregister: (id) =>
        set((s) => ({
          panels: s.panels.filter((p) => p.id !== id),
          openIds: s.openIds.filter((oid) => oid !== id),
        })),

      open: (id) =>
        set((s) =>
          s.openIds.includes(id) ? {} : { openIds: [...s.openIds, id] },
        ),

      close: (id) =>
        set((s) => ({ openIds: s.openIds.filter((oid) => oid !== id) })),

      toggle: (id) => {
        const { openIds, open, close } = get()
        if (openIds.includes(id)) {
          close(id)
        } else {
          open(id)
        }
      },

      setActiveTab: (region, id) =>
        set((s) => ({ activeTab: { ...s.activeTab, [region]: id } })),
    }),
    {
      name: 'scormite-panel-registry',
      // Persist only open/active state, not panel definitions (those are re-registered on mount).
      partialize: (s) => ({ openIds: s.openIds, activeTab: s.activeTab }),
    },
  ),
)

/** Convenience: panels open in a given region. */
export function useRegionPanels(region: PanelRegion): PanelDef[] {
  return usePanelRegistry((s) =>
    s.panels.filter((p) => p.region === region && s.openIds.includes(p.id)),
  )
}

/** Convenience: all panels in a region (open or closed). */
export function useAllRegionPanels(region: PanelRegion): PanelDef[] {
  return usePanelRegistry((s) => s.panels.filter((p) => p.region === region))
}
