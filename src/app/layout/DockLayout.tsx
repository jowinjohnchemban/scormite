/**
 * The Advanced Mode dock.
 *
 *   ┌──────────────────────────────┐
 *   │  left dock │ center │ right   │   ← workspace group (horizontal)
 *   ├──────────────────────────────┤
 *   │        bottom dock (tabs)     │   ← shell group (vertical)
 *   └──────────────────────────────┘
 *
 * Each panel's dock is fixed by its definition. Which panels are shown and how
 * large each dock is both survive a reload; "Reset layout" clears both.
 */

import { useMemo, type ReactNode } from 'react'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { dockGroupId } from './dockStorage'
import { useVisiblePanelIds } from './PanelRegistry'
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
    </div>
  )
}
