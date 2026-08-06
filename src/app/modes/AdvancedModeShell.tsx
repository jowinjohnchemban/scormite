/**
 * Advanced Mode shell — full developer IDE view.
 *
 * Milestone 3: shows DropZone when no package is loaded; shows manifest
 * explorer once a package is loaded.
 * DockLayout + PanelRegistry + all developer panels land in Milestones 6–9.
 */

import { usePackageStore } from '@/features/package-loader'
import { ManifestExplorer } from '@/features/manifest'

export function AdvancedModeShell() {
  const pkg = usePackageStore((s) => s.package)

  if (!pkg) {
    // BasicModeShell owns the DropZone — switch to Basic to load a package.
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Advanced Mode — load a package in Basic Mode first.
        {'\u00A0'}Dock layout and developer panels land in Milestones 6–9.
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Placeholder left panel — ManifestExplorer preview */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]">
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Manifest
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ManifestExplorer />
        </div>
      </aside>

      {/* Placeholder center — player region (Milestone 5) */}
      <main className="flex min-w-0 flex-1 items-center justify-center text-sm text-slate-500">
        Player + dock layout land in Milestones 5–6.
      </main>
    </div>
  )
}
