/** The bottom dock: a tab strip over a single content area (ARIA tabs pattern). */

import { useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useActiveBottomPanelId, usePanelRegistry, useVisiblePanelIds, type PanelDef } from './PanelRegistry'

interface DockTabProps {
  panel: PanelDef
  isActive: boolean
  onSelect: () => void
  onClose: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

function DockTab({ panel, isActive, onSelect, onClose, onKeyDown }: DockTabProps) {
  const Icon = panel.icon

  return (
    <button
      type="button"
      role="tab"
      id={`dock-tab-${panel.id}`}
      aria-selected={isActive}
      aria-controls="dock-bottom-tabpanel"
      tabIndex={isActive ? 0 : -1}
      title={isActive ? `${panel.title} (active)` : `${panel.title}`}
      onClick={onSelect}
      onDoubleClick={onClose}
      onKeyDown={onKeyDown}
      className={cn(
        'group flex shrink-0 items-center gap-1.5 py-1.5 pl-2.5 pr-2 text-xs',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
        isActive
          ? 'border-t border-t-accent bg-surface-950 text-slate-100'
          : 'border-t border-t-transparent text-slate-500 hover:text-slate-300',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {panel.title}
    </button>
  )
}

export function DockTabStrip() {
  const panelIds = useVisiblePanelIds('bottom')
  const activeId = useActiveBottomPanelId()
  const definitions = usePanelRegistry((s) => s.definitions)
  const setActiveBottomTab = usePanelRegistry((s) => s.setActiveBottomTab)
  const close = usePanelRegistry((s) => s.close)
  const stripRef = useRef<HTMLDivElement>(null)

  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Delete / Backspace on the active tab closes it — the keyboard
      // equivalent of the mouse-only close button.
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (activeId) {
          event.preventDefault()
          close(activeId)
        }
        return
      }
      const delta =
        event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (delta === 0 || panelIds.length === 0) return
      event.preventDefault()
      const current = activeId ? panelIds.indexOf(activeId) : 0
      const next = panelIds[(current + delta + panelIds.length) % panelIds.length]
      if (!next) return
      setActiveBottomTab(next)
      // Roving tabindex: focus follows selection, per the ARIA tabs pattern.
      stripRef.current
        ?.querySelector<HTMLButtonElement>(`#dock-tab-${CSS.escape(next)}`)
        ?.focus()
    },
    [panelIds, activeId, setActiveBottomTab, close],
  )

  if (panelIds.length === 0) return null

  const activePanel = activeId ? definitions[activeId] : undefined
  const ActiveComponent = activePanel?.component

  return (
    <div data-testid="dock-region-bottom" className="pointer-events-auto flex h-full flex-col overflow-hidden">
      <div className="flex items-stretch border-b border-border-subtle bg-surface-900">
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Bottom dock panels"
          aria-orientation="horizontal"
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
        >
          {panelIds.map((id) => {
            const panel = definitions[id]
            if (!panel) return null
            return (
              <DockTab
                key={id}
                panel={panel}
                isActive={id === activeId}
                onSelect={() => setActiveBottomTab(id)}
                onClose={() => close(id)}
                onKeyDown={onTabKeyDown}
              />
            )
          })}
        </div>
        <button
          type="button"
          aria-label={activePanel ? `Close ${activePanel.title}` : 'Close active panel'}
          title={activePanel ? `Close ${activePanel.title}` : 'Close active panel'}
          disabled={!activeId}
          onClick={() => activeId && close(activeId)}
          className={cn(
            'shrink-0 rounded px-1.5 text-slate-500 transition-colors hover:bg-surface-700 hover:text-slate-200',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
            'disabled:opacity-40 disabled:hover:bg-transparent',
          )}
        >
          <X className="size-3" aria-hidden />
        </button>
      </div>

      {/* M15 a11y: the panel body scrolls, so it must be keyboard-focusable
          (axe scrollable-region-focusable; also part of the ARIA tabs pattern). */}
      <div
        id="dock-bottom-tabpanel"
        role="tabpanel"
        {...(activeId ? { 'aria-labelledby': `dock-tab-${activeId}` } : {})}
        data-testid={activePanel ? `panel-body-${activePanel.id}` : 'panel-body-empty'}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto bg-surface-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}
