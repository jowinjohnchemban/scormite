/**
 * Basic Mode shell — fixed two-column layout.
 * Left: package summary + manifest tree.  Right: sandboxed iframe player.
 */

import { useState, useCallback } from 'react'
import { DropZone, loadZip, usePackageStore, PackageLoadError } from '@/features/package-loader'
import { ManifestExplorer, parseManifest, useManifestStore, ManifestParseError } from '@/features/manifest'
import {
  PlayerFrame,
  PlayerToolbar,
  registerServiceWorker,
  cachePackageFiles,
  packageLaunchUrl,
  injectApiProxy,
  removeApiProxy,
  clearSessionCache,
} from '@/features/player'
import { Scorm12Adapter, Scorm2004Adapter, recordingMiddleware, useRuntimeStore } from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { runtimeEvents } from '@/features/runtime'
import { useCmiState } from '@/app/hooks/useCmiState'
import type { Package } from '@/shared/types'

// Register service worker once at module load.
void registerServiceWorker()

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
  const pkg = usePackageStore((s) => s.package)
  const setPackage = usePackageStore((s) => s.setPackage)
  const setManifest = useManifestStore((s) => s.setManifest)
  const setAdapter = useRuntimeStore((s) => s.setAdapter)
  const resetRuntime = useRuntimeStore((s) => s.reset)
  const clearLogs = useLogStore((s) => s.clearRecords)
  const addLog = useLogStore((s) => s.addRecord)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [launchUrl, setLaunchUrl] = useState<string | null>(null)

  // ---- package loading ----

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setLoadError(null)
      try {
        const raw = await loadZip(file)
        const manifest = parseManifest(raw.manifestXml)

        const resourceLaunch =
          manifest.resources.find((r) => r.scormType === 'sco')?.href ??
          manifest.resources[0]?.href ??
          ''

        const assembled: Package = {
          id: crypto.randomUUID(),
          name: raw.name,
          sourceType: 'zip',
          scormVersion: raw.scormVersion,
          ...(raw.scormEdition !== undefined ? { scormEdition: raw.scormEdition } : {}),
          manifest,
          launchUrl: resourceLaunch,
          loadedAt: new Date(),
        }

        setManifest(manifest)
        setPackage(assembled)

        // Cache files for the player.
        const sid = assembled.id
        await cachePackageFiles(sid, raw.filePaths, raw.getFile)

        // Create runtime adapter.
        const adapter =
          raw.scormVersion === '1.2'
            ? new Scorm12Adapter(sid)
            : new Scorm2004Adapter(sid)
        adapter.addMiddleware(recordingMiddleware)

        // Wire api-call events to logStore.
        runtimeEvents.on('api-call', addLog)

        setAdapter(adapter, raw.scormVersion)
        injectApiProxy(adapter, raw.scormVersion)

        setSessionId(sid)
        setLaunchUrl(packageLaunchUrl(sid, resourceLaunch))
      } catch (e) {
        if (e instanceof PackageLoadError || e instanceof ManifestParseError) {
          setLoadError(e.message)
        } else {
          setLoadError('An unexpected error occurred while loading the package.')
        }
      } finally {
        setLoading(false)
      }
    },
    [setPackage, setManifest, setAdapter, addLog],
  )

  // ---- player controls ----

  const handleReload = useCallback(() => {
    if (!sessionId || !pkg) return
    setLaunchUrl(null)
    setTimeout(() => setLaunchUrl(packageLaunchUrl(sessionId, pkg.launchUrl)), 50)
  }, [sessionId, pkg])

  const handleReset = useCallback(() => {
    if (sessionId) clearSessionCache(sessionId)
    removeApiProxy()
    resetRuntime()
    clearLogs()
    setSessionId(null)
    setLaunchUrl(null)
  }, [sessionId, resetRuntime, clearLogs])

  // ---- no package loaded ----

  if (!pkg) {
    return <DropZone onFile={handleFile} loading={loading} error={loadError} />
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
        <PlayerToolbar
          onReload={handleReload}
          onReset={handleReset}
          disabled={!launchUrl}
        />
      </main>
    </div>
  )
}
