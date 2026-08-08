/**
 * Stand-in for panels whose feature hasn't landed yet. Each is a real
 * registered panel, so dock behaviour (drag, resize, close, reopen) is
 * exercised against the final panel set rather than a reduced one; the body
 * gets replaced milestone by milestone.
 *
 * Exports a factory rather than a component so callers get one stable
 * component identity per panel instead of a new type on every render.
 */

import type { ComponentType } from 'react'

export function makePlaceholderPanel(label: string, milestone: string): ComponentType {
  function PlaceholderPanel() {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-[11px] text-slate-600">Arrives in {milestone}</p>
      </div>
    )
  }
  PlaceholderPanel.displayName = `PlaceholderPanel(${label})`
  return PlaceholderPanel
}
