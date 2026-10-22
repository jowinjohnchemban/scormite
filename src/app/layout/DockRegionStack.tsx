/**
 * A side dock (left or right): visible panels stacked vertically, each
 * independently resizable.
 */

import { Fragment } from 'react'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { dockGroupId } from './dockStorage'
import { usePanelRegistry, useVisiblePanelIds, type DockRegion } from './PanelRegistry'
import { PanelBody, PanelChrome, ResizeHandle } from './DockPrimitives'

export function DockRegionStack({ region }: { region: DockRegion }) {
  const panelIds = useVisiblePanelIds(region)
  const definitions = usePanelRegistry((s) => s.definitions)

  // Sizes are keyed by the exact set of panels on screen, so opening or
  // closing one doesn't corrupt the sizes remembered for the other combinations.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: dockGroupId(region),
    panelIds,
    storage: localStorage,
  })

  if (panelIds.length === 0) return null

  return (
    <div data-testid={`dock-region-${region}`} className="pointer-events-auto h-full overflow-hidden">
      <Group orientation="vertical" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged} className="h-full">
        {panelIds.map((id, index) => {
          const panel = definitions[id]
          if (!panel) return null
          return (
            <Fragment key={id}>
              {index > 0 && <ResizeHandle orientation="vertical" />}
              <Panel id={id} minSize="64px">
                <div className="flex h-full flex-col overflow-hidden">
                  <PanelChrome panel={panel} />
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
