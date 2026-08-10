/**
 * The icon rail flanking each side dock. Toggles panel visibility, and doubles
 * as a drop target so a panel can be re-docked to a side that is currently empty.
 */

import { cn } from '@/shared/lib/utils'
import {
  usePanelRegistry,
  useRegionPanelIds,
  type DockRegion,
} from './PanelRegistry'
import { usePanelDropTarget } from './usePanelDrag'

function ActivityBarButton({ panelId, side }: { panelId: string; side: DockRegion }) {
  const panel = usePanelRegistry((s) => s.definitions[panelId])
  const isOpen = usePanelRegistry((s) => !s.hidden.includes(panelId))
  const toggle = usePanelRegistry((s) => s.toggle)

  if (!panel) return null
  const Icon = panel.icon

  return (
    <button
      type="button"
      title={panel.title}
      aria-label={`${isOpen ? 'Hide' : 'Show'} ${panel.title}`}
      aria-pressed={isOpen}
      onClick={() => toggle(panelId)}
      className={cn(
        'relative flex size-9 items-center justify-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
        isOpen
          ? 'text-slate-100'
          : 'text-slate-600 hover:text-slate-300',
        // Active indicator strip on the outer edge, VS Code style.
        isOpen && [
          'before:absolute before:inset-y-1 before:w-0.5 before:bg-[var(--color-accent)] before:content-[""]',
          side === 'left' ? 'before:left-0' : 'before:right-0',
        ],
      )}
    >
      <Icon className="size-4.5" aria-hidden />
    </button>
  )
}

export function ActivityBar({ side }: { side: Extract<DockRegion, 'left' | 'right'> }) {
  const panelIds = useRegionPanelIds(side)
  const move = usePanelRegistry((s) => s.move)
  const { isActive, isOver, dropProps } = usePanelDropTarget({
    onDrop: (draggedId) => move(draggedId, side),
  })

  return (
    <div
      {...dropProps}
      data-testid={`activity-bar-${side}`}
      className={cn(
        'pointer-events-auto flex w-10 shrink-0 flex-col items-center bg-[var(--color-surface-900)] py-1',
        side === 'left'
          ? 'border-r border-[var(--color-border-subtle)]'
          : 'border-l border-[var(--color-border-subtle)]',
        isActive && 'bg-[var(--color-surface-800)]',
        isOver && 'ring-2 ring-inset ring-[var(--color-accent)]',
      )}
    >
      {panelIds.map((id) => (
        <ActivityBarButton key={id} panelId={id} side={side} />
      ))}
    </div>
  )
}
