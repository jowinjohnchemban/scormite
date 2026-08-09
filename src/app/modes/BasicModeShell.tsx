/**
 * Basic Mode shell — fixed two-column layout.
 * Left: package summary + manifest tree.  Right: sandboxed iframe player.
 */

import { DropZone } from '@/features/package-loader'
import { ManifestExplorer } from '@/features/manifest'
import { PlayerFrame, PlayerToolbar } from '@/features/player'
import { useCmiState } from '@/app/hooks/useCmiState'
import { usePackageSession } from '@/app/hooks/usePackageSession'

// ---------------------------------------------------------------------------
// CMI summary panel
// ---------------------------------------------------------------------------

function CmiSummaryPanel() {
  const cmi = useCmiState()
  const rows: [string, string][] = [
    ['Status', cmi.completionStatus],
    ['Success', cmi.successStatus],
    ['Score', cmi.scoreRaw || cmi.scoreScaled || '—'],
    ['Location', cmi.location || '—'],
    ['Time', cmi.totalTime || '—'],
  ]
  return (
    <div className="border-t border-[var(--color-border-subtle)] px-3 py-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-0.5 text-xs">
          <span className="text-slate-500">{label}</span>
          <span className="text-slate-300">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function BasicModeShell() {
  const { pkg, loading, error, launchUrl, loadFile, reload, reset } = usePackageSession('basic')

  if (!pkg) {
    return <DropZone onFile={loadFile} loading={loading} error={error} />
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: package info + CMI summary + manifest tree */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-900)]">
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-200" title={pkg.name}>
            {pkg.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            SCORM {pkg.scormVersion}
            {pkg.scormEdition ? ` ${pkg.scormEdition} Edition` : ''}
          </p>
        </div>
        <CmiSummaryPanel />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ManifestExplorer />
        </div>
      </aside>

      {/* Right: player */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <PlayerFrame src={launchUrl} />
        </div>
        <PlayerToolbar onReload={reload} onReset={reset} disabled={!launchUrl} />
      </main>
    </div>
  )
}
