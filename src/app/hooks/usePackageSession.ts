/**
 * React glue for the open package: loading and closing packages, and
 * running the launches / navigation the course store asks for through the
 * `CourseSession` that plays the course.
 *
 * Lives in `app/` because it needs package-loader, manifest, player,
 * runtime, and every store fed by the runtime at once. `App` subscribes
 * exactly once and passes the session to whichever mode shell is active, so
 * a running SCO survives a Basic ↔ Advanced switch.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadZip, PackageLoadError, usePackageStore } from '@/features/package-loader'
import {
  getActivityTree,
  getLaunchableItems,
  ManifestParseError,
  parseManifest,
  useManifestStore,
} from '@/features/manifest'
import {
  cachePackageFiles,
  clearNetworkEntries,
  clearSessionCache,
  packageLaunchUrl,
  registerServiceWorker,
  removeApiProxy,
} from '@/features/player'
import { runtimeEvents, useRuntimeStore, type SequencingOptions } from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { useInspectorStore } from '@/features/inspector'
import { useTimelineStore } from '@/features/timeline'
import { useBreakpointStore } from '@/features/session'
import { ValidationService, useValidationStore } from '@/features/validation'
import { CourseSession } from '@/app/course/CourseSession'
import { summarizeCmi } from '@/app/course/summarizeCmi'
import { useCourseStore } from '@/app/state/courseStore'
import type { ApiCallRecord, LaunchableItem, Manifest, Package } from '@/shared/types'
import { logDevDiagnostic } from '@/shared/lib/devDiagnostics'

// The player serves package files through a service worker; registering is
// idempotent and only needs to happen once per document.
void registerServiceWorker()

/** Calls that can change tracking data, and so navigation availability. */
const TRACKING_METHODS = new Set<ApiCallRecord['method']>(['Initialize', 'SetValue', 'Commit', 'Terminate'])

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
  /** Name of the file being opened, while `loading`. */
  loadingName: string | null
  error: string | null
  /** `null` until a SCO is launched, and while one is being switched. */
  launchUrl: string | null
  /** Changes on every launch; key the player with it so each launch remounts. */
  launchKey: number
  currentItem: LaunchableItem | null
  loadFile: (file: File) => Promise<void>
  /** Relaunch the current SCO with its stored data (a real LMS resume). */
  relaunch: () => void
  /** Discard the current SCO's data and launch it fresh. */
  newAttempt: () => void
  /** Discard every SCO's data and start the course from the beginning. */
  restartCourse: () => void
  /** Close the package and return to the drop zone. */
  close: () => void
  dismissError: () => void
}

/** Clears every store a package session feeds. */
function resetSessionStores(): void {
  removeApiProxy()
  clearNetworkEntries()
  useRuntimeStore.getState().reset()
  useLogStore.getState().clearRecords()
  useInspectorStore.getState().reset()
  useTimelineStore.getState().reset()
  useBreakpointStore.getState().reset()
  useValidationStore.getState().reset()
  useCourseStore.getState().reset()
  useManifestStore.getState().clearManifest()
  usePackageStore.getState().clearPackage()
}

function loadErrorMessage(e: unknown): string {
  if (e instanceof PackageLoadError || e instanceof ManifestParseError) return e.message
  if (e instanceof Error && /service worker/i.test(e.message)) {
    return 'The package player could not start. Reload the page and try again — private browsing modes that block service workers are not supported.'
  }
  return 'An unexpected error occurred while loading the package.'
}

/** SCORM 2004 courses are played by the sequencing engine. */
function sequencingFor(pkg: Package, manifest: Manifest): SequencingOptions | null {
  if (pkg.scormVersion !== '2004') return null
  const activityTree = getActivityTree(manifest)
  if (!activityTree) return null
  return {
    activityTree,
    ...(manifest.sequencingCollections ? { collections: manifest.sequencingCollections } : {}),
  }
}

export function usePackageSession(owner: 'basic' | 'advanced'): PackageSession {
  const pkg = usePackageStore((s) => s.package)
  const items = useCourseStore((s) => s.items)
  const currentItemId = useCourseStore((s) => s.currentItemId)
  const pendingLaunch = useCourseStore((s) => s.pendingLaunch)
  const pendingNavigation = useCourseStore((s) => s.pendingNavigation)
  const launchKey = useCourseStore((s) => s.launchCount)

  const [loading, setLoading] = useState(false)
  const [loadingName, setLoadingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<CourseSession | null>(null)

  const currentItem = items.find((item) => item.identifier === currentItemId) ?? null
  const launchUrl =
    pkg && currentItem && pendingLaunch === null && pendingNavigation === null
      ? packageLaunchUrl(pkg.id, currentItem.launchPath)
      : null

  // ---------------------------------------------------------------------------
  // Runtime → stores. Subscribed once for the lifetime of the App; doing this
  // per launch stacked listeners and duplicated every log record.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubApi = runtimeEvents.on('api-call', (record) => {
      useLogStore.getState().addRecord(record)
      logDevelopmentApiCall(record)
      const { adapter, sessionId, scormVersion } = useRuntimeStore.getState()
      if (!adapter || !sessionId || !scormVersion) return
      try {
        const flattened = adapter.getFlattenedCmi()
        useTimelineStore.getState().captureSnapshot({ timestamp: record.timestamp, sessionId, data: flattened })
        // While the timeline is scrubbing a historical snapshot the
        // inspector keeps showing that instant.
        if (useTimelineStore.getState().cursor === null) {
          useInspectorStore.getState().updateValues(flattened)
        }
        const itemId = useCourseStore.getState().currentItemId
        if (itemId) useCourseStore.getState().setProgress(itemId, summarizeCmi(flattened, scormVersion))
        if (TRACKING_METHODS.has(record.method)) sessionRef.current?.refresh()
      } catch {
        // The player may have navigated away while the event was being handled.
      }
    })
    const unsubInit = runtimeEvents.on('initialized', () => {
      useRuntimeStore.getState().setInitialized(true)
    })
    const unsubTerm = runtimeEvents.on('terminated', () => {
      useRuntimeStore.getState().setTerminated(true)
    })
    return () => {
      unsubApi()
      unsubInit()
      unsubTerm()
    }
  }, [])

  // Launches and navigation run after React has committed the request, i.e.
  // after the previous SCO's iframe is gone and its unload handlers have
  // already called LMSFinish / Terminate on the previous runtime state.
  useEffect(() => {
    if (pendingLaunch) sessionRef.current?.deliver(pendingLaunch)
  }, [pendingLaunch])

  useEffect(() => {
    if (pendingNavigation) sessionRef.current?.navigate(pendingNavigation)
  }, [pendingNavigation])

  // Stop listening to the runtime if the app itself unmounts.
  useEffect(
    () => () => {
      sessionRef.current?.dispose()
      sessionRef.current = null
    },
    [],
  )

  const teardown = useCallback(() => {
    sessionRef.current?.dispose()
    sessionRef.current = null
    const current = usePackageStore.getState().package
    if (current) clearSessionCache(current.id)
    resetSessionStores()
  }, [])

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setLoadingName(file.name)
      setError(null)
      logDevDiagnostic('package.load.started', { owner, name: file.name, size: file.size })
      try {
        const raw = await loadZip(file)
        const manifest = parseManifest(raw.manifestXml)
        const launchable = getLaunchableItems(manifest)
        const first = launchable[0]
        if (!first) {
          throw new PackageLoadError(
            `"${file.name}" has no launchable item: no organization item references a resource with an href.`,
          )
        }

        // The new package is valid — only now replace the open one.
        teardown()

        const assembled: Package = {
          id: crypto.randomUUID(),
          name: raw.name,
          sourceType: 'zip',
          scormVersion: raw.scormVersion,
          ...(raw.scormEdition !== undefined ? { scormEdition: raw.scormEdition } : {}),
          manifest,
          launchUrl: first.launchPath,
          loadedAt: new Date(),
        }

        useManifestStore.getState().setManifest(manifest)
        usePackageStore.getState().setPackage(assembled)
        // The archive bytes are discarded after caching; the file list stays
        // for the Package Explorer.
        usePackageStore.getState().setFilePaths(raw.filePaths)
        ValidationService.validateManifest(manifest, raw.filePaths, raw.rootFolder)

        await cachePackageFiles(assembled.id, raw.filePaths, raw.getFile)
        logDevDiagnostic('package.cache.ready', { owner, packageId: assembled.id, files: raw.filePaths.length })

        const session = new CourseSession(assembled, launchable, sequencingFor(assembled, manifest))
        sessionRef.current = session
        session.start()
      } catch (e) {
        logDevDiagnostic('package.load.failed', { owner, error: e instanceof Error ? e.message : String(e) })
        if (import.meta.env.DEV) console.error('[Scormite session] Failed to load package', e)
        setError(loadErrorMessage(e))
      } finally {
        setLoading(false)
        setLoadingName(null)
      }
    },
    [owner, teardown],
  )

  const relaunch = useCallback(() => {
    const course = useCourseStore.getState()
    if (course.currentItemId) course.requestLaunch(course.currentItemId, 'resume')
  }, [])

  const newAttempt = useCallback(() => {
    const course = useCourseStore.getState()
    if (course.currentItemId) course.requestLaunch(course.currentItemId, 'new')
  }, [])

  const restartCourse = useCallback(() => sessionRef.current?.restart(), [])

  const close = useCallback(() => {
    logDevDiagnostic('session.close.requested', { owner })
    teardown()
    setError(null)
  }, [owner, teardown])

  const dismissError = useCallback(() => setError(null), [])

  return {
    pkg,
    loading,
    loadingName,
    error,
    launchUrl,
    launchKey,
    currentItem,
    loadFile,
    relaunch,
    newAttempt,
    restartCourse,
    close,
    dismissError,
  }
}
