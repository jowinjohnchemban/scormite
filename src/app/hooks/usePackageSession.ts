/**
 * Owns the load-a-package-and-start-a-runtime-session flow.
 *
 * Lives in `app/` because completing it needs four features at once
 * (package-loader, manifest, player, runtime) and no single feature is
 * allowed to reach across to the others. Both mode shells consume this
 * rather than each re-implementing the sequence.
 */

import { useCallback, useEffect, useState } from 'react'
import { loadZip, PackageLoadError, usePackageStore } from '@/features/package-loader'
import { ManifestParseError, parseManifest, useManifestStore } from '@/features/manifest'
import {
  cachePackageFiles,
  clearSessionCache,
  injectApiProxy,
  packageLaunchUrl,
  registerServiceWorker,
  removeApiProxy,
} from '@/features/player'
import {
  recordingMiddleware,
  runtimeEvents,
  Scorm12Adapter,
  Scorm2004Adapter,
  useRuntimeStore,
} from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { useInspectorStore } from '@/features/inspector'
import type { ApiCallRecord, Package } from '@/shared/types'

// The player serves package files through a service worker; registering is
// idempotent and only needs to happen once per document.
void registerServiceWorker()

function logDevelopmentApiCall(record: ApiCallRecord): void {
  if (!import.meta.env.DEV) return
  if (record.errorCode) {
    console.warn('[Scormite runtime] SCORM API call failed', record)
    return
  }
  console.debug('[Scormite runtime] SCORM API call', record)
}

export interface PackageSession {
  pkg: Package | null
  loading: boolean
  error: string | null
  /** `null` until a package is loaded, and briefly during a reload. */
  launchUrl: string | null
  loadFile: (file: File) => Promise<void>
  reload: () => void
  reset: () => void
}

export function usePackageSession(): PackageSession {
  const pkg = usePackageStore((s) => s.package)
  const setPackage = usePackageStore((s) => s.setPackage)
  const setManifest = useManifestStore((s) => s.setManifest)
  const setAdapter = useRuntimeStore((s) => s.setAdapter)
  const resetRuntime = useRuntimeStore((s) => s.reset)
  const clearLogs = useLogStore((s) => s.clearRecords)
  const addLog = useLogStore((s) => s.addRecord)
  const setCmiBaseline = useInspectorStore((s) => s.setBaseline)
  const updateCmi = useInspectorStore((s) => s.updateValues)
  const resetInspector = useInspectorStore((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [launchUrl, setLaunchUrl] = useState<string | null>(null)

  // Subscribed once for the lifetime of the shell. Doing this per-load (as the
  // shells used to) stacked a fresh listener on every package, duplicating
  // every subsequent log record.
  useEffect(
    () =>
      runtimeEvents.on('api-call', (record) => {
        addLog(record)
        logDevelopmentApiCall(record)
        const adapter = useRuntimeStore.getState().adapter
        if (!adapter) return
        try {
          updateCmi(adapter.getFlattenedCmi())
        } catch {
          // The player may have navigated away while the event was being handled.
        }
      }),
    [addLog, updateCmi],
  )

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
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

        const sid = assembled.id
        await cachePackageFiles(sid, raw.filePaths, raw.getFile)

        const adapter =
          raw.scormVersion === '1.2' ? new Scorm12Adapter(sid) : new Scorm2004Adapter(sid)
        adapter.addMiddleware(recordingMiddleware)

        setAdapter(adapter, raw.scormVersion)
        setCmiBaseline(adapter.getFlattenedCmi())
        injectApiProxy(adapter, raw.scormVersion)

        if (import.meta.env.DEV) {
          console.info('[Scormite session] Package loaded', {
            name: assembled.name,
            scormVersion: assembled.scormVersion,
            sessionId: sid,
          })
        }

        setSessionId(sid)
        setLaunchUrl(packageLaunchUrl(sid, resourceLaunch))
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[Scormite session] Failed to load package', e)
        }
        if (e instanceof PackageLoadError || e instanceof ManifestParseError) {
          setError(e.message)
        } else {
          setError('An unexpected error occurred while loading the package.')
        }
      } finally {
        setLoading(false)
      }
    },
    [setPackage, setManifest, setAdapter, setCmiBaseline],
  )

  const reload = useCallback(() => {
    if (!sessionId || !pkg) return
    // Blanking the src first forces the iframe to remount rather than
    // re-navigating, so the SCO starts from a clean document.
    setLaunchUrl(null)
    setTimeout(() => setLaunchUrl(packageLaunchUrl(sessionId, pkg.launchUrl)), 50)
  }, [sessionId, pkg])

  const reset = useCallback(() => {
    if (sessionId) clearSessionCache(sessionId)
    removeApiProxy()
    resetRuntime()
    clearLogs()
    resetInspector()
    setSessionId(null)
    setLaunchUrl(null)
  }, [sessionId, resetRuntime, clearLogs, resetInspector])

  return { pkg, loading, error, launchUrl, loadFile, reload, reset }
}
