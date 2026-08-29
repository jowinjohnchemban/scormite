/**
 * The Advanced Mode dock.
 *
 *   ┌────┬──────────────────────────────┬────┐
 *   │ A  │  left dock │ center │ right  │ A  │   ← workspace group (horizontal)
 *   │ c  ├──────────────────────────────┤ c  │
 *   │ t  │        bottom dock           │ t  │   ← shell group (vertical)
 *   └────┴──────────────────────────────┴────┘
 *
 * Which panels live in which dock comes from `PanelRegistry`; how large each
 * dock is comes from react-resizable-panels' own persistence. Both survive a
 * reload, and "Reset layout" in the toolbar clears both.
 */

import { useMemo, type ReactNode } from 'react'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { dockGroupId } from './dockStorage'
import { useVisiblePanelIds } from './PanelRegistry'
import { ActivityBar } from './ActivityBar'
import { DockRegionStack } from './DockRegionStack'
import { DockTabStrip } from './DockTabStrip'
import { ResizeHandle } from './DockPrimitives'

interface DockLayoutProps {
  /** The non-dockable center region — the player. */
  center: ReactNode
}

export function DockLayout({ center }: DockLayoutProps) {
  const hasLeft = useVisiblePanelIds('left').length > 0
  const hasRight = useVisiblePanelIds('right').length > 0
  const hasBottom = useVisiblePanelIds('bottom').length > 0

  // Sizes are remembered per combination of visible docks, so closing the
  // bottom dock and reopening it restores the height it had before.
  const shellIds = useMemo(
    () => (hasBottom ? ['workspace', 'bottom-dock'] : ['workspace']),
    [hasBottom],
  )
  const workspaceIds = useMemo(
    () =>
      [hasLeft ? 'left-dock' : null, 'center', hasRight ? 'right-dock' : null].filter(
        (id): id is string => id !== null,
      ),
    [hasLeft, hasRight],
  )

  const shell = useDefaultLayout({
    id: dockGroupId('shell'),
    panelIds: shellIds,
    storage: localStorage,
  })
  const workspace = useDefaultLayout({
    id: dockGroupId('workspace'),
    panelIds: workspaceIds,
    storage: localStorage,
  })

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ActivityBar side="left" />

      <div className="min-w-0 flex-1">
        <Group
          orientation="vertical"
          defaultLayout={shell.defaultLayout}
          onLayoutChanged={shell.onLayoutChanged}
          className="h-full"
        >
          <Panel id="workspace" minSize="25%">
            <Group
              orientation="horizontal"
              defaultLayout={workspace.defaultLayout}
              onLayoutChanged={workspace.onLayoutChanged}
              className="h-full"
            >
              {hasLeft && (
                <Panel id="left-dock" defaultSize="20%" minSize="10%" maxSize="45%">
                  <DockRegionStack region="left" />
                </Panel>
              )}
              {hasLeft && <ResizeHandle orientation="horizontal" />}

              <Panel id="center" minSize="25%">
                {/* Transparent so the persistent player layer (App) shows through. */}
                <div className="h-full overflow-hidden">
                  {center}
                </div>
              </Panel>

              {hasRight && <ResizeHandle orientation="horizontal" />}
              {hasRight && (
                <Panel id="right-dock" defaultSize="22%" minSize="10%" maxSize="45%">
                  <DockRegionStack region="right" />
                </Panel>
              )}
            </Group>
          </Panel>

          {hasBottom && <ResizeHandle orientation="vertical" />}
          {hasBottom && (
            <Panel id="bottom-dock" defaultSize="32%" minSize="10%" maxSize="70%">
              <DockTabStrip />
            </Panel>
          )}
        </Group>
      </div>

      <ActivityBar side="right" />
    </div>
  )
}
