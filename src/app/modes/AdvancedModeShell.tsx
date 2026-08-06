/**
 * Advanced Mode shell — full developer IDE view.
 * Uses DockLayout + PanelRegistry.
 * Developer panels (API Monitor, CMI Inspector, etc.) land in Milestones 7–14.
 */

import { useEffect } from 'react'
import { DockLayout } from '@/app/layout/DockLayout'
import { usePanelRegistry } from '@/app/layout/PanelRegistry'
import { PlaceholderPanel } from '@/app/layout/PlaceholderPanel'
import { ManifestExplorer } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { DropZone, loadZip, PackageLoadError } from '@/features/package-loader'
import { useState, useCallback } from 'react'
import { parseManifest, useManifestStore, ManifestParseError } from '@/features/manifest'
import {
  registerServiceWorker,
  cachePackageFiles,
  packageLaunchUrl,
  injectApiProxy,
  PlayerFrame,
  PlayerToolbar,
  clearSessionCache,
  removeApiProxy,
} from '@/features/player'
import { Scorm12Adapter, Scorm2004Adapter, recordingMiddleware, useRuntimeStore } from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { runtimeEvents } from '@/features/runtime'
import type { Package } from '@/shared/types'

void registerServiceWorker()

// ---------------------------------------------------------------------------
// Panel registration — done once when this module is first loaded
// ---------------------------------------------------------------------------

function useRegisterPanels() {
  const register = usePanelRegistry((s) => s.register)

  useEffect(() => {
    // Left region
    register({ id: 'manifest-explorer', title: 'Manifest', region: 'left', component: ManifestExplorer, defaultOpen: true })
    register({ id: 'package-explorer', title: 'Package', region: 'left', component: () => <PlaceholderPanel label="Package Explorer" />, defaultOpen: false })
    // Right region
    register({ id: 'cmi-inspector', title: 'CMI Inspector', region: 'right', component: () => <PlaceholderPanel label="CMI Inspector (M7)" />, defaultOpen: true })
    register({ id: 'validation-panel', title: 'Validation', region: 'right', component: () => <PlaceholderPanel label="Validation Panel (M10)" />, defaultOpen: false })
    // Bottom region
    register({ id: 'api-monitor', title: 'API Monitor', region: 'bottom', component: () => <PlaceholderPanel label="API Monitor (M7)" />, defaultOpen: true })
    register({ id: 'console', title: 'Console', region: 'bottom', component: () => <PlaceholderPanel label="Console (M7)" />, defaultOpen: true })
    register({ id: 'timeline', title: 'Timeline', region: 'bottom', component: () => <PlaceholderPanel label="Timeline (M8)" />, defaultOpen: false })
    register({ id: 'breakpoints', title: 'Breakpoints', region: 'bottom', component: () => <PlaceholderPanel label="Breakpoints (M9)" />, defaultOpen: false })
    register({ id: 'reports', title: 'Reports', region: 'bottom', component: () => <PlaceholderPanel label="Reports (M12)" />, defaultOpen: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ---------------------------------------------------------------------------
// Center content (player or drop zone)
// ---------------------------------------------------------------------------

function CenterContent() {
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

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setLoadError(null)
      try {
        const raw = await loadZip(file)
        const manifest = parseManifest(raw.manifestXml)
        const resourceLaunch =
          manifest.resources.find((r) => r.scormType === 'sco')?.href ??
          manifest.resources[0]?.href ?? ''

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

        const sid = assembled.id
        await cachePackageFiles(sid, raw.filePaths, raw.getFile)

        const adapter = raw.scormVersion === '1.2'
          ? new Scorm12Adapter(sid)
          : new Scorm2004Adapter(sid)
        adapter.addMiddleware(recordingMiddleware)
        runtimeEvents.on('api-call', addLog)
        setAdapter(adapter, raw.scormVersion)
        injectApiProxy(adapter, raw.scormVersion)
        setSessionId(sid)
        setLaunchUrl(packageLaunchUrl(sid, resourceLaunch))
      } catch (e) {
        if (e instanceof PackageLoadError || e instanceof ManifestParseError) {
          setLoadError(e.message)
        } else {
          setLoadError('Unexpected error loading package.')
        }
      } finally {
        setLoading(false)
      }
    },
    [setPackage, setManifest, setAdapter, addLog],
  )

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

  if (!pkg) {
    return <DropZone onFile={handleFile} loading={loading} error={loadError} />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <PlayerFrame src={launchUrl} />
      </div>
      <PlayerToolbar onReload={handleReload} onReset={handleReset} disabled={!launchUrl} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function AdvancedModeShell() {
  useRegisterPanels()
  return <DockLayout center={<CenterContent />} />
}
