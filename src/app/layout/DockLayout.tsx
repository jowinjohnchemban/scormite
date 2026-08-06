import React from 'react'
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  useDefaultLayout,
} from 'react-resizable-panels'
import { cn } from '@/shared/lib/utils'
import {
  usePanelRegistry,
  useRegionPanels,
  useAllRegionPanels,
} from './PanelRegistry'

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  return (
    <PanelResizeHandle
      className={cn(
        'relative flex items-center justify-center bg-transparent transition-colors',
        'hover:bg-[var(--color-accent)]/20 active:bg-[var(--color-accent)]/30',
        direction === 'horizontal'
          ? 'w-px cursor-col-resize'
          : 'h-px cursor-row-resize',
      )}
    >
      <div
        className={cn(
          'rounded-full bg-[var(--color-border-subtle)]',
          direction === 'horizontal' ? 'h-8 w-px' : 'h-px w-8',
        )}
      />
    </PanelResizeHandle>
  )
}

// ---------------------------------------------------------------------------
// Panel header (title + close button)
// ---------------------------------------------------------------------------

function PanelHeader({ title, panelId }: { title: string; panelId: string }) {
  const close = usePanelRegistry((s) => s.close)
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </span>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={() => close(panelId)}
        className="rounded p-0.5 text-slate-600 transition-colors hover:bg-[var(--color-surface-700)] hover:text-slate-300"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Side region (left / right) — single panel stack or nothing
// ---------------------------------------------------------------------------

function SideRegion({ region }: { region: 'left' | 'right' }) {
  const panels = useRegionPanels(region)
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    panelIds: panels.map((p) => p.id),
    ...(typeof window !== 'undefined' ? { storage: localStorage } : {}),
    id: `scormite-${region}`,
  })
  if (panels.length === 0) return null

  return (
    <PanelGroup orientation="vertical" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      {panels.map((panel, i) => (
        <React.Fragment key={panel.id}>
          {i > 0 && <ResizeHandle direction="vertical" />}
          <Panel defaultSize={100 / panels.length} minSize={10}>
            <div className="flex h-full flex-col overflow-hidden">
              <PanelHeader title={panel.title} panelId={panel.id} />
              <div className="min-h-0 flex-1 overflow-auto">
                <panel.component />
              </div>
            </div>
          </Panel>
        </React.Fragment>
      ))}
    </PanelGroup>
  )
}

// ---------------------------------------------------------------------------
// Bottom region — tab strip
// ---------------------------------------------------------------------------

function BottomRegion() {
  const allPanels = useAllRegionPanels('bottom')
  const openIds = usePanelRegistry((s) => s.openIds)
  const activeTab = usePanelRegistry((s) => s.activeTab['bottom'])
  const setActiveTab = usePanelRegistry((s) => s.setActiveTab)
  const open = usePanelRegistry((s) => s.open)
  const close = usePanelRegistry((s) => s.close)

  const openPanels = allPanels.filter((p) => openIds.includes(p.id))
  const closedPanels = allPanels.filter((p) => !openIds.includes(p.id))

  // Pick a valid active tab.
  const active = (activeTab && openPanels.find((p) => p.id === activeTab))
    ? activeTab
    : openPanels[0]?.id

  const activePanel = openPanels.find((p) => p.id === active)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab strip */}
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-900)] px-2">
        {openPanels.map((panel) => (
          <div key={panel.id} className="group flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('bottom', panel.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-t px-3 py-1.5 text-xs transition-colors',
                panel.id === active
                  ? 'bg-[var(--color-surface-800)] text-slate-200'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {panel.title}
            </button>
            <button
              type="button"
              aria-label={`Close ${panel.title}`}
              onClick={() => {
                close(panel.id)
                if (panel.id === active && openPanels.length > 1) {
                  const next = openPanels.find((p) => p.id !== panel.id)
                  if (next) setActiveTab('bottom', next.id)
                }
              }}
              className="mr-1 rounded p-0.5 text-slate-600 opacity-0 transition-all hover:text-slate-300 group-hover:opacity-100"
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}

        {/* Re-open closed panels */}
        {closedPanels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            title={`Open ${panel.title}`}
            onClick={() => { open(panel.id); setActiveTab('bottom', panel.id) }}
            className="rounded px-2 py-1.5 text-xs text-slate-600 transition-colors hover:text-slate-400"
          >
            + {panel.title}
          </button>
        ))}
      </div>

      {/* Active panel content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {activePanel && <activePanel.component />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel toggle toolbar (opens closed side panels)
// ---------------------------------------------------------------------------

function SidePanelToggles({ region }: { region: 'left' | 'right' }) {
  const allPanels = useAllRegionPanels(region)
  const openIds = usePanelRegistry((s) => s.openIds)
  const toggle = usePanelRegistry((s) => s.toggle)

  return (
    <div className="flex flex-col gap-0.5 px-0.5 py-1">
      {allPanels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          title={panel.title}
          onClick={() => toggle(panel.id)}
          className={cn(
            'rounded px-2 py-1 text-xs transition-colors',
            openIds.includes(panel.id)
              ? 'bg-[var(--color-accent-muted)] text-slate-200'
              : 'text-slate-600 hover:text-slate-400',
          )}
        >
          {panel.title}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main DockLayout
// ---------------------------------------------------------------------------

interface DockLayoutProps {
  /** Content for the center region (player). */
  center: React.ReactNode
}

/**
 * VS Code-style dockable layout.
 * Regions: left sidebar | center | right sidebar (top half),
 * bottom panel strip (bottom half).
 * Panel sizes are persisted to localStorage via react-resizable-panels autoSaveId.
 */
export function DockLayout({ center }: DockLayoutProps) {
  const leftPanels = useRegionPanels('left')
  const rightPanels = useRegionPanels('right')
  const allBottomPanels = useAllRegionPanels('bottom')

  const hasLeft = leftPanels.length > 0
  const hasRight = rightPanels.length > 0
  const hasBottom = allBottomPanels.length > 0

  const vertIds = ['top-half', 'bottom-half']
  const { defaultLayout: vLayout, onLayoutChanged: onVLayoutChanged } = useDefaultLayout({
    panelIds: vertIds,
    ...(typeof window !== 'undefined' ? { storage: localStorage } : {}),
    id: 'scormite-vertical',
  })
  const hIds = ['left-panel', 'center-panel', 'right-panel']
  const { defaultLayout: hLayout, onLayoutChanged: onHLayoutChanged } = useDefaultLayout({
    panelIds: hIds,
    ...(typeof window !== 'undefined' ? { storage: localStorage } : {}),
    id: 'scormite-horizontal',
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left toggle strip */}
      <div className="flex w-6 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]">
        <SidePanelToggles region="left" />
      </div>

      {/* Main content area */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <PanelGroup orientation="vertical" defaultLayout={vLayout} onLayoutChanged={onVLayoutChanged}>
          {/* Top half: left | center | right */}
          <Panel id="top-half" defaultSize={hasBottom ? 65 : 100} minSize={30}>
            <PanelGroup orientation="horizontal" defaultLayout={hLayout} onLayoutChanged={onHLayoutChanged}>
              {hasLeft && (
                <>
                  <Panel id="left-panel" defaultSize={20} minSize={10} maxSize={40}>
                    <div className="h-full overflow-hidden border-r border-[var(--color-border-subtle)]">
                      <SideRegion region="left" />
                    </div>
                  </Panel>
                  <ResizeHandle direction="horizontal" />
                </>
              )}

              <Panel id="center-panel" minSize={30}>
                <div className="h-full overflow-hidden">{center}</div>
              </Panel>

              {hasRight && (
                <>
                  <ResizeHandle direction="horizontal" />
                  <Panel id="right-panel" defaultSize={22} minSize={10} maxSize={40}>
                    <div className="h-full overflow-hidden border-l border-[var(--color-border-subtle)]">
                      <SideRegion region="right" />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Bottom panel */}
          {hasBottom && (
            <>
              <ResizeHandle direction="vertical" />
              <Panel id="bottom-half" defaultSize={35} minSize={15} maxSize={60}>
                <div className="h-full overflow-hidden border-t border-[var(--color-border-subtle)]">
                  <BottomRegion />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Right toggle strip */}
      <div className="flex w-6 shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]">
        <SidePanelToggles region="right" />
      </div>
    </div>
  )
}
