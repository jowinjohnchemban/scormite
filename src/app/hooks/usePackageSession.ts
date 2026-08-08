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
import type { Package } from '@/shared/types'

// The player serves package files through a service worker; registering is
// idempotent and only needs to happen once per document.
void registerServiceWorker()

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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [launchUrl, setLaunchUrl] = useState<string | null>(null)

  // Subscribed once for the lifetime of the shell. Doing this per-load (as the
  // shells used to) stacked a fresh listener on every package, duplicating
  // every subsequent log record.
  useEffect(() => runtimeEvents.on('api-call', addLog), [addLog])

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
        injectApiProxy(adapter, raw.scormVersion)

        setSessionId(sid)
        setLaunchUrl(packageLaunchUrl(sid, resourceLaunch))
      } catch (e) {
        if (e instanceof PackageLoadError || e instanceof ManifestParseError) {
          setError(e.message)
        } else {
          setError('An unexpected error occurred while loading the package.')
        }
      } finally {
        setLoading(false)
      }
    },
    [setPackage, setManifest, setAdapter],
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
    setSessionId(null)
    setLaunchUrl(null)
  }, [sessionId, resetRuntime, clearLogs])

  return { pkg, loading, error, launchUrl, loadFile, reload, reset }
}
