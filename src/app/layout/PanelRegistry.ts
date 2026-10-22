/**
 * PanelRegistry — which Advanced-mode panels exist, where each lives, and
 * which are shown.
 *
 * Every panel has a fixed home dock chosen for what it is used for (course
 * structure on the left, runtime state on the right, logs and tools in the
 * bottom tabs). Testers show, hide, and resize panels; moving them between
 * docks was removed because it added controls and layout states without
 * helping anyone test a package.
 *
 * Persisted: only the tester's show/hide choices and the active bottom tab.
 * Definitions are registered at runtime, so a panel added in a later release
 * appears with its default visibility.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { clearStoredPanelSizes, PANEL_LAYOUT_STORAGE_KEY } from './dockStorage'

/** A dock. The center region is reserved for the player. */
export type DockRegion = 'left' | 'right' | 'bottom'

/** What a panel is for — how the Panels menu groups them. */
export type PanelGroup = 'course' | 'runtime' | 'problems'

export interface PanelDef {
  id: string
  title: string
  group: PanelGroup
  /** The panel's home dock. */
  region: DockRegion
  /** Whether it is shown until the tester says otherwise. */
  defaultOpen: boolean
  component: ComponentType
  icon: LucideIcon
}

/** The persisted slice. */
interface PanelLayoutState {
  /** Explicit show (true) / hide (false) choices, by panel id. */
  visibility: Record<string, boolean>
  /** Active tab of the bottom dock. */
  activeBottomTab: string | null
}

interface PanelRegistryState extends PanelLayoutState {
  /** Registered definitions, in registration (display) order. Not persisted. */
  definitions: Record<string, PanelDef>
  order: string[]

  register: (panel: PanelDef) => void
  open: (id: string) => void
  close: (id: string) => void
  toggle: (id: string) => void
  setActiveBottomTab: (id: string) => void
  /** Restore default visibility and panel sizes. */
  resetLayout: () => void
}

function isVisible(state: Pick<PanelRegistryState, 'definitions' | 'visibility'>, id: string): boolean {
  return state.visibility[id] ?? state.definitions[id]?.defaultOpen ?? false
}

export const usePanelRegistry = create<PanelRegistryState>()(
  persist(
    (set, get) => ({
      visibility: {},
      activeBottomTab: null,
      definitions: {},
      order: [],

      register: (panel) =>
        set((s) =>
          s.definitions[panel.id]
            ? {}
            : { definitions: { ...s.definitions, [panel.id]: panel }, order: [...s.order, panel.id] },
        ),

      open: (id) =>
        set((s) => ({
          visibility: { ...s.visibility, [id]: true },
          ...(s.definitions[id]?.region === 'bottom' ? { activeBottomTab: id } : {}),
        })),

      close: (id) => set((s) => ({ visibility: { ...s.visibility, [id]: false } })),

      toggle: (id) => {
        const state = get()
        if (isVisible(state, id)) state.close(id)
        else state.open(id)
      },

      setActiveBottomTab: (id) => set({ activeBottomTab: id }),

      resetLayout: () => {
        clearStoredPanelSizes()
        set({ visibility: {}, activeBottomTab: null })
      },
    }),
    {
      name: PANEL_LAYOUT_STORAGE_KEY,
      version: 2,
      partialize: (s): PanelLayoutState => ({ visibility: s.visibility, activeBottomTab: s.activeBottomTab }),
      // Layouts saved before panels had fixed homes (version < 2) described
      // dock placement; only fresh defaults make sense for them.
      migrate: () => ({ visibility: {}, activeBottomTab: null }),
    },
  ),
)

// ---------------------------------------------------------------------------
// Selectors — arrays go through `useShallow` so a fresh array per call does
// not re-render on every store write.
// ---------------------------------------------------------------------------

/** Visible panels of a dock, in display order. */
export function useVisiblePanelIds(region: DockRegion): string[] {
  return usePanelRegistry(
    useShallow((s) => s.order.filter((id) => s.definitions[id]?.region === region && isVisible(s, id))),
  )
}

export function usePanelVisible(id: string): boolean {
  return usePanelRegistry((s) => isVisible(s, id))
}

/** The bottom dock's active tab, falling back to its first visible panel. */
export function useActiveBottomPanelId(): string | undefined {
  return usePanelRegistry((s) => {
    const visible = s.order.filter((id) => s.definitions[id]?.region === 'bottom' && isVisible(s, id))
    return s.activeBottomTab !== null && visible.includes(s.activeBottomTab) ? s.activeBottomTab : visible[0]
  })
}
