/**
 * Advanced Mode — the developer view: dockable panels around a center player,
 * with a toolbar that controls the dock.
 *
 * The panels themselves are declared in `app/layout/panels.ts`; this shell
 * only registers them and supplies the center region.
 */

import { useEffect } from 'react'
import { DockLayout } from '@/app/layout/DockLayout'
import { TopToolbar } from '@/app/layout/TopToolbar'
import { ADVANCED_PANELS } from '@/app/layout/panels'
import { usePanelRegistry } from '@/app/layout/PanelRegistry'
import { usePackageSession } from '@/app/hooks/usePackageSession'
import { useTimelineReplay } from '@/app/hooks/useTimelineReplay'
import { DropZone } from '@/features/package-loader'
import { PlayerFrame, PlayerToolbar } from '@/features/player'
import type { Package } from '@/shared/types'

function useRegisterAdvancedPanels(): void {
  const register = usePanelRegistry((s) => s.register)
  useEffect(() => {
    for (const panel of ADVANCED_PANELS) register(panel)
  }, [register])
}

function PackageStatus({ pkg }: { pkg: Package | null }) {
  if (!pkg) {
    return <span className="text-xs text-slate-600">No package loaded</span>
  }
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-xs text-slate-300" title={pkg.name}>
        {pkg.name}
      </span>
      <span className="shrink-0 text-[11px] text-slate-600">
        SCORM {pkg.scormVersion}
        {pkg.scormEdition ? ` ${pkg.scormEdition}` : ''}
      </span>
    </div>
  )
}

export function AdvancedModeShell() {
  useRegisterAdvancedPanels()
  useTimelineReplay()
  const { pkg, loading, error, launchUrl, loadFile, reload, reset } = usePackageSession('advanced')

  const center = pkg ? (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <PlayerFrame src={launchUrl} />
      </div>
      <PlayerToolbar onReload={reload} onReset={reset} disabled={!launchUrl} />
    </div>
  ) : (
    <DropZone onFile={loadFile} loading={loading} error={error} />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopToolbar>
        <PackageStatus pkg={pkg} />
      </TopToolbar>
      <div className="min-h-0 flex-1">
        <DockLayout center={center} />
      </div>
    </div>
  )
}
