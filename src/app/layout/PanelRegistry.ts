/**
 * PanelRegistry — the single source of truth for Advanced Mode's dock layout.
 *
 * Features register their panels here (via `register`); the registry owns
 * *where* each panel is docked, whether it is visible, and the order within
 * a region. Panel definitions themselves are runtime-only — only the layout
 * (order / hidden / active tab) is persisted, so a panel added in a future
 * release picks up its `defaultRegion` + `defaultOpen` without clobbering
 * the placement the user chose for everything else.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { clearStoredPanelSizes, PANEL_LAYOUT_STORAGE_KEY } from './dockStorage'

export const DOCK_REGIONS = ['left', 'right', 'bottom'] as const

/** A dockable region. The center region is reserved for the player and is not dockable. */
export type DockRegion = (typeof DOCK_REGIONS)[number]

export interface PanelDef {
  id: string
  title: string
  /** Region this panel docks to the first time it is ever registered. */
  defaultRegion: DockRegion
  /** Whether it is visible the first time it is ever registered. */
  defaultOpen: boolean
  component: ComponentType
  icon: LucideIcon
}

type RegionOrder = Record<DockRegion, string[]>

/** The persisted slice: everything a reload must restore. */
interface DockLayoutState {
  /** Panel ids per region, in display order. May contain ids with no current definition. */
  order: RegionOrder
  /** Ids the user has explicitly closed. */
  hidden: string[]
  /** Active tab per region (only tabbed regions use this). */
  activeTab: Partial<Record<DockRegion, string>>
}

interface PanelRegistryState extends DockLayoutState {
  /** Registered definitions, keyed by id. Not persisted. */
  definitions: Record<string, PanelDef>
  /** Id of the panel currently being dragged, or null. Not persisted. */
  draggingId: string | null

  register: (panel: PanelDef) => void
  unregister: (id: string) => void
  open: (id: string) => void
  close: (id: string) => void
  toggle: (id: string) => void
  /** Dock `id` into `region`, inserting before `beforeId` when given (else append). */
  move: (id: string, region: DockRegion, beforeId?: string) => void
  setActiveTab: (region: DockRegion, id: string) => void
  /** Discard all user layout customisation, including stored panel sizes. */
  resetLayout: () => void
  beginDrag: (id: string) => void
  endDrag: () => void
}

const emptyOrder = (): RegionOrder => ({ left: [], right: [], bottom: [] })

function regionOf(order: RegionOrder, id: string): DockRegion | undefined {
  return DOCK_REGIONS.find((region) => order[region].includes(id))
}

function isKnown(order: RegionOrder, id: string): boolean {
  return regionOf(order, id) !== undefined
}

/** Layout seeded purely from panel definitions — i.e. what a first-run user sees. */
function defaultLayoutFor(definitions: Record<string, PanelDef>): DockLayoutState {
  const order = emptyOrder()
  const hidden: string[] = []
  for (const panel of Object.values(definitions)) {
    order[panel.defaultRegion].push(panel.id)
    if (!panel.defaultOpen) hidden.push(panel.id)
  }
  return { order, hidden, activeTab: {} }
}

/** First visible panel in `region`, excluding `excludeId`. */
function firstVisible(
  state: Pick<PanelRegistryState, 'order' | 'hidden' | 'definitions'>,
  region: DockRegion,
  excludeId?: string,
): string | undefined {
  return state.order[region].find(
    (id) =>
      id !== excludeId &&
      state.definitions[id] !== undefined &&
      !state.hidden.includes(id),
  )
}

export const usePanelRegistry = create<PanelRegistryState>()(
  persist(
    (set, get) => ({
      order: emptyOrder(),
      hidden: [],
      activeTab: {},
      definitions: {},
      draggingId: null,

      register: (panel) =>
        set((s) => {
          if (s.definitions[panel.id]) return {}
          const definitions = { ...s.definitions, [panel.id]: panel }
          // A panel already present in the persisted order keeps whatever
          // placement and visibility the user last left it in.
          if (isKnown(s.order, panel.id)) return { definitions }
          return {
            definitions,
            order: {
              ...s.order,
              [panel.defaultRegion]: [...s.order[panel.defaultRegion], panel.id],
            },
            hidden: panel.defaultOpen ? s.hidden : [...s.hidden, panel.id],
          }
        }),

      // Layout entries survive unregistration on purpose: a panel that comes
      // back (HMR, a plugin re-registering) returns to where the user put it.
      unregister: (id) =>
        set((s) => {
          if (!s.definitions[id]) return {}
          const definitions = { ...s.definitions }
          delete definitions[id]
          return { definitions }
        }),

      open: (id) =>
        set((s) => {
          const region = regionOf(s.order, id)
          return {
            hidden: s.hidden.filter((h) => h !== id),
            ...(region ? { activeTab: { ...s.activeTab, [region]: id } } : {}),
          }
        }),

      close: (id) =>
        set((s) => {
          if (s.hidden.includes(id)) return {}
          const hidden = [...s.hidden, id]
          const region = regionOf(s.order, id)
          if (!region || s.activeTab[region] !== id) return { hidden }
          // Closing the active tab promotes the next visible sibling.
          const next = firstVisible({ ...s, hidden }, region)
          const activeTab = { ...s.activeTab }
          if (next === undefined) delete activeTab[region]
          else activeTab[region] = next
          return { hidden, activeTab }
        }),

      toggle: (id) => {
        const { hidden, open, close } = get()
        if (hidden.includes(id)) open(id)
        else close(id)
      },

      move: (id, region, beforeId) =>
        set((s) => {
          if (id === beforeId) return {}
          const from = regionOf(s.order, id)
          const order = emptyOrder()
          for (const r of DOCK_REGIONS) order[r] = s.order[r].filter((p) => p !== id)
          const index = beforeId ? order[region].indexOf(beforeId) : -1
          if (index >= 0) order[region].splice(index, 0, id)
          else order[region].push(id)

          const hidden = s.hidden.filter((h) => h !== id)
          const activeTab = { ...s.activeTab, [region]: id }
          // The source region may have just lost its active tab.
          if (from && from !== region && s.activeTab[from] === id) {
            const next = firstVisible({ ...s, order, hidden }, from)
            if (next === undefined) delete activeTab[from]
            else activeTab[from] = next
          }
          return { order, hidden, activeTab }
        }),

      setActiveTab: (region, id) =>
        set((s) => ({ activeTab: { ...s.activeTab, [region]: id } })),

      resetLayout: () => {
        clearStoredPanelSizes()
        set((s) => defaultLayoutFor(s.definitions))
      },

      beginDrag: (id) => set({ draggingId: id }),
      endDrag: () => set({ draggingId: null }),
    }),
    {
      name: PANEL_LAYOUT_STORAGE_KEY,
      // Definitions are re-registered on every mount; drag state is ephemeral.
      partialize: (s): DockLayoutState => ({
        order: s.order,
        hidden: s.hidden,
        activeTab: s.activeTab,
      }),
      // A version bump from a release that changed region names would otherwise
      // rehydrate an order object missing a region key.
      merge: (persisted, current) => {
        const saved = persisted as Partial<DockLayoutState> | undefined
        return {
          ...current,
          ...saved,
          order: { ...emptyOrder(), ...saved?.order },
          hidden: saved?.hidden ?? [],
          activeTab: saved?.activeTab ?? {},
        }
      },
    },
  ),
)

// ---------------------------------------------------------------------------
// Selectors
//
// These return arrays, so they go through `useShallow` — zustand v5 compares
// snapshots with Object.is, and a freshly-built array every call would
// re-render on every store write (and trip React's getSnapshot cache warning).
// ---------------------------------------------------------------------------

/** All registered panels docked in `region`, in display order (visible or not). */
export function useRegionPanelIds(region: DockRegion): string[] {
  return usePanelRegistry(
    useShallow((s) => s.order[region].filter((id) => s.definitions[id] !== undefined)),
  )
}

/** Registered *and* visible panels docked in `region`, in display order. */
export function useVisiblePanelIds(region: DockRegion): string[] {
  return usePanelRegistry(
    useShallow((s) =>
      s.order[region].filter(
        (id) => s.definitions[id] !== undefined && !s.hidden.includes(id),
      ),
    ),
  )
}

export function usePanelDef(id: string): PanelDef | undefined {
  return usePanelRegistry((s) => s.definitions[id])
}

/** The active tab for a tabbed region, falling back to its first visible panel. */
export function useActivePanelId(region: DockRegion): string | undefined {
  return usePanelRegistry((s) => {
    const active = s.activeTab[region]
    const usable =
      active !== undefined &&
      s.order[region].includes(active) &&
      s.definitions[active] !== undefined &&
      !s.hidden.includes(active)
    return usable ? active : firstVisible(s, region)
  })
}
