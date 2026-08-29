/**
 * Advanced Mode — the developer view: dockable panels around a center player,
 * with a toolbar that controls the dock.
 *
 * The panels themselves are declared in `app/layout/panels.ts`; this shell
 * only registers them and supplies the center region.
 *
 * The iframe lives in `App` (persistent player layer) so a running SCO
 * survives mode switches; this shell provides the dock chrome on top.
 */

import { useEffect, useRef } from 'react'
import { DockLayout } from '@/app/layout/DockLayout'
import { TopToolbar } from '@/app/layout/TopToolbar'
import { ADVANCED_PANELS } from '@/app/layout/panels'
import { usePanelRegistry } from '@/app/layout/PanelRegistry'
import { useTimelineReplay } from '@/app/hooks/useTimelineReplay'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { DropZone } from '@/features/package-loader'
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

export function AdvancedModeShell({
  session,
  onCenterRegionRectChange,
}: {
  session: PackageSession
  onCenterRegionRectChange?: (rect: DOMRect | null) => void
}) {
  useRegisterAdvancedPanels()
  useTimelineReplay()
  const { pkg, loading, error } = session

  // The iframe in App is sized to the center dock region.
  const centerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!onCenterRegionRectChange) return
    const node = centerRef.current
    if (!node) {
      // No package yet — App falls back to its default framing.
      onCenterRegionRectChange(null)
      return
    }
    const update = () => onCenterRegionRectChange(node.getBoundingClientRect())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [onCenterRegionRectChange, pkg])

  const center = pkg ? (
    /* Transparent center: the persistent player layer shows through. */
    <div ref={centerRef} className="pointer-events-none h-full" />
  ) : (
    /* Opaque backdrop so the empty-state drop zone covers the player layer. */
    <div className="pointer-events-auto h-full bg-surface-950">
      <DropZone onFile={session.loadFile} loading={loading} error={error} />
    </div>
  )

  return (
    <div className="pointer-events-none absolute inset-0 flex min-h-0 flex-col overflow-hidden">
      <TopToolbar>
        <PackageStatus pkg={pkg} />
      </TopToolbar>
      <div className="min-h-0 flex-1">
        <DockLayout center={center} />
      </div>
    </div>
  )
}
