/** Small shared pieces of the dock: resize handles, panel chrome, drop affordances. */

import { Separator as PanelResizeHandle } from 'react-resizable-panels'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { usePanelRegistry, type DockRegion, type PanelDef } from './PanelRegistry'
import { usePanelDragSource, usePanelDropTarget } from './usePanelDrag'

export function ResizeHandle({
  orientation,
}: {
  orientation: 'horizontal' | 'vertical'
}) {
  return (
    <PanelResizeHandle
      className={cn(
        'pointer-events-auto group relative shrink-0 bg-border-subtle transition-colors',
        'data-[state=drag]:bg-accent hover:bg-accent',
        // A 1px seam with a larger invisible hit area, DevTools-style.
        orientation === 'horizontal'
          ? 'w-px cursor-col-resize after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-[""]'
          : 'h-px cursor-row-resize after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-[""]',
      )}
    />
  )
}

/**
 * A drop line rendered between panels. Purely visual — the surrounding
 * element owns the drop handlers.
 */
export function DropIndicator({
  orientation,
}: {
  orientation: 'horizontal' | 'vertical'
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'shrink-0 bg-accent',
        orientation === 'horizontal' ? 'h-full w-0.5' : 'h-0.5 w-full',
      )}
    />
  )
}

interface PanelChromeProps {
  panel: PanelDef
  /** Region the panel is currently docked in; a drop here inserts before it. */
  region: DockRegion
}

/** Title bar for a stacked (non-tabbed) panel: drag grip, title, close. */
export function PanelChrome({ panel, region }: PanelChromeProps) {
  const close = usePanelRegistry((s) => s.close)
  const move = usePanelRegistry((s) => s.move)
  const dragSource = usePanelDragSource(panel.id)
  const { isOver, dropProps } = usePanelDropTarget({
    onDrop: (draggedId) => move(draggedId, region, panel.id),
    accepts: (draggedId) => draggedId !== panel.id,
  })

  const Icon = panel.icon

  return (
    <div
      {...dragSource}
      {...dropProps}
      data-testid={`panel-header-${panel.id}`}
      className={cn(
        'flex h-7 shrink-0 cursor-grab items-center justify-between gap-2 border-b px-2 active:cursor-grabbing',
        'border-border-subtle bg-surface-900',
        isOver && 'border-t-2 border-t-accent',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {panel.title}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Close ${panel.title}`}
        onClick={() => close(panel.id)}
        className="rounded p-0.5 text-slate-500 transition-colors hover:bg-surface-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  )
}

/** Renders a registered panel's own component, isolated to its own scroll box. */
export function PanelBody({ panel }: { panel: PanelDef }) {
  const Component = panel.component
  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-surface-950"
      data-testid={`panel-body-${panel.id}`}
    >
      <Component />
    </div>
  )
}
