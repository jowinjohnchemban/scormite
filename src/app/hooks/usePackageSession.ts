/**
 * Owns the load-a-package-and-start-a-runtime-session flow.
 *
 * Lives in `app/` because completing it needs four features at once
 * (package-loader, manifest, player, runtime) and no single feature is
 * allowed to reach across to the others. `App` subscribes exactly once for
 * the lifetime of the app (with the current mode as owner) and passes the
 * resulting session down to the active mode shell, so a running SCO survives
 * a Basic ↔ Advanced switch without a second concurrent subscription.
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
  createBreakpointMiddleware,
  createValidationMiddleware,
  missingCommitValidator,
  outOfRangeScoreValidator,
  oversizedSuspendDataValidator,
  recordingMiddleware,
  runtimeEvents,
  Scorm12Adapter,
  Scorm2004Adapter,
  useRuntimeStore,
} from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { useInspectorStore } from '@/features/inspector'
import { useTimelineStore } from '@/features/timeline'
import { useBreakpointStore } from '@/features/session'
import { ValidationService, useValidationStore } from '@/features/validation'
import type { ApiCallRecord, Package } from '@/shared/types'
import { logDevDiagnostic } from '@/shared/lib/devDiagnostics'

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

export function usePackageSession(owner: 'basic' | 'advanced'): PackageSession {
  const pkg = usePackageStore((s) => s.package)
  const setPackage = usePackageStore((s) => s.setPackage)
  const setManifest = useManifestStore((s) => s.setManifest)
  const setAdapter = useRuntimeStore((s) => s.setAdapter)
  const resetRuntime = useRuntimeStore((s) => s.reset)
  const runtimeSessionId = useRuntimeStore((s) => s.sessionId)
  const clearLogs = useLogStore((s) => s.clearRecords)
  const addLog = useLogStore((s) => s.addRecord)
  const setCmiBaseline = useInspectorStore((s) => s.setBaseline)
  const updateCmi = useInspectorStore((s) => s.updateValues)
  const resetInspector = useInspectorStore((s) => s.reset)
  const captureSnapshot = useTimelineStore((s) => s.captureSnapshot)
  const resetTimeline = useTimelineStore((s) => s.reset)
  const resetBreakpoints = useBreakpointStore((s) => s.reset)
  const resetValidation = useValidationStore((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  // Package and runtime state outlive either mode shell. Deriving the launch
  // URL from both lets a running SCO survive a Basic ↔ Advanced mode switch.
  const launchUrl =
    pkg && runtimeSessionId && !reloading
      ? packageLaunchUrl(runtimeSessionId, pkg.launchUrl)
      : null

  useEffect(() => {
    logDevDiagnostic('session.shell.mounted', { owner })
    return () => logDevDiagnostic('session.shell.unmounted', { owner })
  }, [owner])

  useEffect(() => {
    logDevDiagnostic('session.launch-state', {
      owner,
      packageId: pkg?.id ?? null,
      packageName: pkg?.name ?? null,
      runtimeSessionId,
      launchUrl,
      reloading,
    })
  }, [owner, pkg, runtimeSessionId, launchUrl, reloading])

  // Subscribed once for the lifetime of the App. Doing this per-load stacked
  // a fresh listener on every package, duplicating every subsequent log record.
  useEffect(
    () =>
      runtimeEvents.on('api-call', (record) => {
        addLog(record)
        logDevelopmentApiCall(record)
        logDevDiagnostic('runtime.api-call', {
          owner,
          method: record.method,
          element: record.element ?? null,
          returnValue: record.returnValue,
          errorCode: record.errorCode ?? null,
        })
        const adapter = useRuntimeStore.getState().adapter
        const sessionId = useRuntimeStore.getState().sessionId
        if (!adapter || !sessionId) return
        try {
          const flattened = adapter.getFlattenedCmi()
          captureSnapshot({ timestamp: record.timestamp, sessionId, data: flattened })
          // While the timeline is scrubbing a historical snapshot the
          // inspector keeps showing that instant; only live updates while
          // following the running session.
          if (useTimelineStore.getState().cursor === null) {
            updateCmi(flattened)
          }
        } catch {
          // The player may have navigated away while the event was being handled.
        }
      }),
    [addLog, updateCmi, captureSnapshot, owner],
  )

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      logDevDiagnostic('package.load.started', { owner, name: file.name, size: file.size })
      try {
        const raw = await loadZip(file)
        logDevDiagnostic('package.load.parsed', {
          owner,
          name: raw.name,
          scormVersion: raw.scormVersion,
          files: raw.filePaths.length,
        })
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

        // Static validation: manifest-vs-package-file consistency. Runtime
        // issues stream in live from the validation middleware below.
        ValidationService.validateManifest(manifest, raw.filePaths)

        const sid = assembled.id
        await cachePackageFiles(sid, raw.filePaths, raw.getFile)
        logDevDiagnostic('package.cache.ready', { owner, sessionId: sid, files: raw.filePaths.length })

        const adapter =
          raw.scormVersion === '1.2' ? new Scorm12Adapter(sid) : new Scorm2004Adapter(sid)
        adapter.addMiddleware(recordingMiddleware)
        // Breakpoints pause matching calls *before* they reach scorm-again.
        // The middleware only signals; the adapter owns the gate, and the
        // breakpoint store mirrors the pause state for the UI.
        adapter.addMiddleware(
          createBreakpointMiddleware({
            getBreakpoints: () => useBreakpointStore.getState().breakpoints,
            onHit: (hit) => useBreakpointStore.getState().recordHit(hit),
          }),
        )
        adapter.onPauseChange((paused) =>
          useBreakpointStore.getState().setPausedFlag(paused),
        )
        useBreakpointStore.getState().setResumeHandler(() => adapter.resume())

        // Runtime validation runs on every completed call. The rule list is
        // re-read per call so runtime profiles (Milestone 11) can toggle
        // which validators apply without rebuilding the pipeline.
        adapter.addMiddleware(
          createValidationMiddleware({
            getValidators: () => [
              outOfRangeScoreValidator,
              oversizedSuspendDataValidator,
              missingCommitValidator,
            ],
            onIssue: (issue) => useValidationStore.getState().addIssue(issue),
          }),
        )

        setAdapter(adapter, raw.scormVersion)
        setCmiBaseline(adapter.getFlattenedCmi())
        injectApiProxy(adapter, raw.scormVersion)
        logDevDiagnostic('runtime.adapter.ready', {
          owner,
          sessionId: sid,
          scormVersion: raw.scormVersion,
          launchPath: resourceLaunch,
        })

        if (import.meta.env.DEV) {
          console.info('[Scormite session] Package loaded', {
            name: assembled.name,
            scormVersion: assembled.scormVersion,
            sessionId: sid,
          })
        }

      } catch (e) {
        logDevDiagnostic('package.load.failed', {
          owner,
          error: e instanceof Error ? e.message : String(e),
        })
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
    [setPackage, setManifest, setAdapter, setCmiBaseline, owner],
  )

  const reload = useCallback(() => {
    if (!runtimeSessionId || !pkg) return
    // Blanking the src first forces the iframe to remount rather than
    // re-navigating, so the SCO starts from a clean document.
    setReloading(true)
    logDevDiagnostic('session.reload.requested', { owner, sessionId: runtimeSessionId })
    setTimeout(() => setReloading(false), 50)
  }, [runtimeSessionId, pkg, owner])

  const reset = useCallback(() => {
    logDevDiagnostic('session.reset.requested', { owner, sessionId: runtimeSessionId })
    if (runtimeSessionId) clearSessionCache(runtimeSessionId)
    removeApiProxy()
    resetRuntime()
    clearLogs()
    resetInspector()
    resetTimeline()
    resetBreakpoints()
    resetValidation()
    setReloading(false)
  }, [runtimeSessionId, resetRuntime, clearLogs, resetInspector, resetTimeline, resetBreakpoints, resetValidation, owner])
  return { pkg, loading, error, launchUrl, loadFile, reload, reset }
}
