/**
 * Advanced Mode's toolbar: which panels are shown (grouped by what they are
 * for), resetting the layout, and the mode-specific status on the right.
 */

import type { ReactNode } from 'react'
import { Check, LayoutGrid, RotateCcw } from 'lucide-react'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'
import { cn } from '@/shared/lib/utils'
import { usePanelRegistry, usePanelVisible, type PanelGroup } from './PanelRegistry'

const GROUPS: readonly { id: PanelGroup; label: string }[] = [
  { id: 'course', label: 'Course' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'problems', label: 'Problems' },
]

function PanelMenuRow({ panelId }: { panelId: string }) {
  const panel = usePanelRegistry((s) => s.definitions[panelId])
  const isOpen = usePanelVisible(panelId)
  const toggle = usePanelRegistry((s) => s.toggle)
  if (!panel) return null
  const Icon = panel.icon
  return (
    <MenuItem checked={isOpen} onClick={() => toggle(panelId)}>
      <Check className={cn('text-accent', !isOpen && 'invisible')} aria-hidden />
      <Icon className="text-slate-500" aria-hidden />
      <span className="truncate">{panel.title}</span>
    </MenuItem>
  )
}

function ViewMenu() {
  const definitions = usePanelRegistry((s) => s.definitions)
  const order = usePanelRegistry((s) => s.order)
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
      {GROUPS.map((group) => {
        const ids = order.filter((id) => definitions[id]?.group === group.id)
        if (ids.length === 0) return null
        return (
          <div key={group.id}>
            <MenuLabel>{group.label}</MenuLabel>
            {ids.map((id) => (
              <PanelMenuRow key={id} panelId={id} />
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
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
