/**
 * Advanced Mode's toolbar. Owns the dock's global controls: which panels are
 * visible, where each one is docked, and resetting the layout.
 *
 * The per-panel region buttons here are not a convenience — they are the
 * keyboard-accessible equivalent of dragging a panel between docks, which
 * pointer-only HTML5 drag-and-drop can't provide on its own.
 */

import type { ReactNode } from 'react'
import { Check, LayoutGrid, RotateCcw } from 'lucide-react'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'
import { cn } from '@/shared/lib/utils'
import { ProfileMenu } from '@/features/settings'
import {
  DOCK_REGIONS,
  usePanelRegistry,
  type DockRegion,
} from './PanelRegistry'

const REGION_LABEL: Record<DockRegion, string> = {
  left: 'Left',
  right: 'Right',
  bottom: 'Bottom',
}

const REGION_SHORT: Record<DockRegion, string> = {
  left: 'L',
  right: 'R',
  bottom: 'B',
}

function PanelMenuRow({ panelId, region }: { panelId: string; region: DockRegion }) {
  const panel = usePanelRegistry((s) => s.definitions[panelId])
  const isOpen = usePanelRegistry((s) => !s.hidden.includes(panelId))
  const toggle = usePanelRegistry((s) => s.toggle)
  const move = usePanelRegistry((s) => s.move)

  if (!panel) return null
  const Icon = panel.icon

  return (
    <div className="flex items-center gap-1">
      <MenuItem checked={isOpen} onClick={() => toggle(panelId)} className="flex-1">
        <Check className={cn('text-accent', !isOpen && 'invisible')} aria-hidden />
        <Icon className="text-slate-500" aria-hidden />
        <span className="truncate">{panel.title}</span>
      </MenuItem>
      <div className="flex shrink-0 gap-0.5 pr-1">
        {DOCK_REGIONS.map((target) => (
          <button
            key={target}
            type="button"
            aria-label={`Dock ${panel.title} to ${REGION_LABEL[target]}`}
            aria-pressed={target === region}
            disabled={target === region}
            onClick={() => move(panelId, target)}
            className={cn(
              'size-5 rounded text-[10px] font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              target === region
                ? 'bg-accent-muted text-slate-100'
                : 'text-slate-500 hover:bg-surface-700 hover:text-slate-200',
            )}
          >
            {REGION_SHORT[target]}
          </button>
        ))}
      </div>
    </div>
  )
}

function ViewMenu() {
  const order = usePanelRegistry((s) => s.order)
  const definitions = usePanelRegistry((s) => s.definitions)
  const resetLayout = usePanelRegistry((s) => s.resetLayout)

  return (
    <Menu
      label={
        <>
          <LayoutGrid aria-hidden />
          Panels
        </>
      }
    >
      {DOCK_REGIONS.map((region) => {
        const ids = order[region].filter((id) => definitions[id] !== undefined)
        if (ids.length === 0) return null
        return (
          <div key={region}>
            <MenuLabel>{REGION_LABEL[region]} dock</MenuLabel>
            {ids.map((id) => (
              <PanelMenuRow key={id} panelId={id} region={region} />
            ))}
          </div>
        )
      })}
      <MenuSeparator />
      <MenuItem onClick={resetLayout}>
        <RotateCcw aria-hidden />
        Reset layout
      </MenuItem>
    </Menu>
  )
}

/** `children` is the mode-specific right-hand side (package status, run controls). */
export function TopToolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="pointer-events-auto flex h-9 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-900 px-2">
      <ViewMenu />
      <ProfileMenu />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
