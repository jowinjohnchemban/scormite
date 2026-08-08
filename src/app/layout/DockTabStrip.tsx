/**
 * The bottom dock: a VS Code-style tab strip over a single content area.
 * Tabs are drag sources (re-dock elsewhere) and drop targets (reorder).
 */

import { useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  useActivePanelId,
  usePanelRegistry,
  useVisiblePanelIds,
  type DockRegion,
  type PanelDef,
} from './PanelRegistry'
import { usePanelDragSource, usePanelDropTarget } from './usePanelDrag'

const REGION: DockRegion = 'bottom'

interface DockTabProps {
  panel: PanelDef
  isActive: boolean
  onSelect: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

function DockTab({ panel, isActive, onSelect, onKeyDown }: DockTabProps) {
  const close = usePanelRegistry((s) => s.close)
  const move = usePanelRegistry((s) => s.move)
  const dragSource = usePanelDragSource(panel.id)
  const { isOver, dropProps } = usePanelDropTarget({
    onDrop: (draggedId) => move(draggedId, REGION, panel.id),
    accepts: (draggedId) => draggedId !== panel.id,
  })

  const Icon = panel.icon

  return (
    <div
      role="presentation"
      {...dragSource}
      {...dropProps}
      className={cn(
        'group flex shrink-0 cursor-grab items-center active:cursor-grabbing',
        isOver && 'border-l-2 border-l-[var(--color-accent)]',
      )}
    >
      <button
        type="button"
        role="tab"
        id={`dock-tab-${panel.id}`}
        aria-selected={isActive}
        aria-controls="dock-bottom-tabpanel"
        tabIndex={isActive ? 0 : -1}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          'flex items-center gap-1.5 py-1.5 pl-2.5 pr-1 text-xs transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
          isActive
            ? 'border-t border-t-[var(--color-accent)] bg-[var(--color-surface-950)] text-slate-100'
            : 'border-t border-t-transparent text-slate-500 hover:text-slate-300',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {panel.title}
      </button>
      <button
        type="button"
        aria-label={`Close ${panel.title}`}
        onClick={() => close(panel.id)}
        className={cn(
          'mr-1 rounded p-0.5 text-slate-500 transition-colors hover:bg-[var(--color-surface-700)] hover:text-slate-200',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  )
}

export function DockTabStrip() {
  const panelIds = useVisiblePanelIds(REGION)
  const activeId = useActivePanelId(REGION)
  const definitions = usePanelRegistry((s) => s.definitions)
  const setActiveTab = usePanelRegistry((s) => s.setActiveTab)
  const move = usePanelRegistry((s) => s.move)
  const stripRef = useRef<HTMLDivElement>(null)

  // Dropping on the empty part of the strip docks the panel at the end.
  const { isActive, isOver, dropProps } = usePanelDropTarget({
    onDrop: (draggedId) => move(draggedId, REGION),
  })

  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const delta =
        event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (delta === 0 || panelIds.length === 0) return
      event.preventDefault()
      const current = activeId ? panelIds.indexOf(activeId) : 0
      const next = panelIds[(current + delta + panelIds.length) % panelIds.length]
      if (!next) return
      setActiveTab(REGION, next)
      // Roving tabindex: focus follows selection, per the ARIA tabs pattern.
      stripRef.current
        ?.querySelector<HTMLButtonElement>(`#dock-tab-${CSS.escape(next)}`)
        ?.focus()
    },
    [panelIds, activeId, setActiveTab],
  )

  if (panelIds.length === 0) return null

  const activePanel = activeId ? definitions[activeId] : undefined
  const ActiveComponent = activePanel?.component

  return (
    <div
      {...dropProps}
      data-testid={`dock-region-${REGION}`}
      className={cn(
        'flex h-full flex-col overflow-hidden',
        isActive && 'ring-1 ring-inset ring-[var(--color-border-subtle)]',
        isOver && 'ring-2 ring-[var(--color-accent)]',
      )}
    >
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Bottom dock panels"
        aria-orientation="horizontal"
        className="flex shrink-0 items-stretch overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]"
      >
        {panelIds.map((id) => {
          const panel = definitions[id]
          if (!panel) return null
          return (
            <DockTab
              key={id}
              panel={panel}
              isActive={id === activeId}
              onSelect={() => setActiveTab(REGION, id)}
              onKeyDown={onTabKeyDown}
            />
          )
        })}
      </div>

      <div
        id="dock-bottom-tabpanel"
        role="tabpanel"
        {...(activeId ? { 'aria-labelledby': `dock-tab-${activeId}` } : {})}
        data-testid={activePanel ? `panel-body-${activePanel.id}` : 'panel-body-empty'}
        className="min-h-0 flex-1 overflow-auto bg-[var(--color-surface-950)]"
      >
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}
