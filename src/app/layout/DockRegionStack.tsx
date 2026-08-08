/**
 * A side dock (left or right): visible panels stacked vertically, each
 * independently resizable, each a drop target for re-docking.
 */

import { Fragment } from 'react'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { cn } from '@/shared/lib/utils'
import { dockGroupId } from './dockStorage'
import {
  usePanelRegistry,
  useVisiblePanelIds,
  type DockRegion,
} from './PanelRegistry'
import { PanelBody, PanelChrome, ResizeHandle } from './DockPrimitives'
import { usePanelDropTarget } from './usePanelDrag'

export function DockRegionStack({ region }: { region: DockRegion }) {
  const panelIds = useVisiblePanelIds(region)
  const definitions = usePanelRegistry((s) => s.definitions)
  const move = usePanelRegistry((s) => s.move)

  // Sizes are keyed by the exact set of panels on screen, so opening or
  // closing one doesn't corrupt the sizes remembered for the other combinations.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: dockGroupId(region),
    panelIds,
    storage: localStorage,
  })

  // Dropping anywhere in the region that isn't a panel header appends.
  const { isActive, isOver, dropProps } = usePanelDropTarget({
    onDrop: (draggedId) => move(draggedId, region),
  })

  if (panelIds.length === 0) return null

  return (
    <div
      {...dropProps}
      data-testid={`dock-region-${region}`}
      className={cn(
        'h-full overflow-hidden',
        isActive && 'ring-1 ring-inset ring-[var(--color-border-subtle)]',
        isOver && 'ring-2 ring-[var(--color-accent)]',
      )}
    >
      <Group
        orientation="vertical"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="h-full"
      >
        {panelIds.map((id, index) => {
          const panel = definitions[id]
          if (!panel) return null
          return (
            <Fragment key={id}>
              {index > 0 && <ResizeHandle orientation="vertical" />}
              <Panel id={id} minSize="64px">
                <div className="flex h-full flex-col overflow-hidden">
                  <PanelChrome panel={panel} region={region} />
                  <PanelBody panel={panel} />
                </div>
              </Panel>
            </Fragment>
          )
        })}
      </Group>
    </div>
  )
}
