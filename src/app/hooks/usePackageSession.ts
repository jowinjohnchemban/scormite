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
import { usePackageStore } from '@/features/package-loader'
import { useManifestStore } from '@/features/manifest'
import {
  clearNetworkEntries,
  clearSessionCache,
  packageLaunchUrl,
  registerServiceWorker,
  removeApiProxy,
} from '@/features/player'
import { runtimeEvents, useRuntimeStore } from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { useInspectorStore } from '@/features/inspector'
import { useTimelineStore } from '@/features/timeline'
import { useBreakpointStore } from '@/features/session'
import { ValidationService, useValidationStore } from '@/features/validation'
import type { CourseSession } from '@/app/course/CourseSession'
import { summarizeCmi, type CmiSummary } from '@/app/course/summarizeCmi'
import { useCourseStore } from '@/app/state/courseStore'
import type { ApiCallRecord, LaunchableItem, Package } from '@/shared/types'
import { logDevDiagnostic } from '@/shared/lib/devDiagnostics'

// The player serves package files through a service worker; registering is
// idempotent and only needs to happen once per document.
void registerServiceWorker()

/** Calls after which the engine's view of the course may have changed. */
const TRACKING_METHODS = new Set<ApiCallRecord['method']>(['Initialize', 'Commit', 'Terminate'])
/** SetValue elements that feed status, scoring, or sequencing. */
const TRACKING_ELEMENTS = /status|score|objectives|progress_measure|exit|adl.nav/

function changesTracking(record: ApiCallRecord): boolean {
  if (TRACKING_METHODS.has(record.method)) return true
  return record.method === 'SetValue' && TRACKING_ELEMENTS.test(record.element ?? '')
}

function sameSummary(a: CmiSummary | undefined, b: CmiSummary): boolean {
  return (
    a !== undefined &&
    a.completionStatus === b.completionStatus &&
    a.successStatus === b.successStatus &&
    a.score === b.score &&
    a.location === b.location &&
    a.time === b.time
  )
}

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

/** Unzip, parsing, and the runtime load on demand with the first package. */
const loadOpenPackage = () => import('@/app/course/openPackage')

export function usePackageSession(owner: 'basic' | 'advanced'): PackageSession {
  const pkg = usePackageStore((s) => s.package)
  const items = useCourseStore((s) => s.items)
  const currentItemId = useCourseStore((s) => s.currentItemId)
  const pendingLaunch = useCourseStore((s) => s.pendingLaunch)
  const pendingNavigation = useCourseStore((s) => s.pendingNavigation)
  const launchKey = useCourseStore((s) => s.launchCount)
  const endedReason = useCourseStore((s) => s.endedReason)

  const [loading, setLoading] = useState(false)
  const [loadingName, setLoadingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<CourseSession | null>(null)
  /** One load at a time: overlapping loads would interleave teardown and setup. */
  const loadingRef = useRef(false)

  const currentItem = items.find((item) => item.identifier === currentItemId) ?? null
  // Nothing plays once the course has ended — until a relaunch or restart.
  const launchUrl =
    pkg && currentItem && pendingLaunch === null && pendingNavigation === null && endedReason === null
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
        const course = useCourseStore.getState()
        if (course.currentItemId) {
          const summary = summarizeCmi(flattened, scormVersion)
          if (!sameSummary(course.progress[course.currentItemId], summary)) {
            course.setProgress(course.currentItemId, summary)
          }
        }
        if (changesTracking(record)) sessionRef.current?.refresh()
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
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setLoadingName(file.name)
      setError(null)
      logDevDiagnostic('package.load.started', { owner, name: file.name, size: file.size })
      const packageId = crypto.randomUUID()
      try {
        const { parsePackage, createCourseSession } = await loadOpenPackage()
        const parsed = await parsePackage(file)
        const first = parsed.items[0]
        if (!first) return

        // Cache the new package's files under its own id first: if that
        // fails, the open package is untouched and keeps running.
        await parsed.cacheFiles(packageId)
        logDevDiagnostic('package.cache.ready', { owner, packageId, files: parsed.filePaths.length })

        // The new package is ready — only now replace the open one.
        teardown()

        const assembled: Package = {
          id: packageId,
          name: parsed.name,
          sourceType: 'zip',
          scormVersion: parsed.scormVersion,
          ...(parsed.scormEdition !== undefined ? { scormEdition: parsed.scormEdition } : {}),
          manifest: parsed.manifest,
          launchUrl: first.launchPath,
          loadedAt: new Date(),
        }
        useManifestStore.getState().setManifest(parsed.manifest)
        usePackageStore.getState().setPackage(assembled)
        // The archive bytes are discarded after caching; the file list stays
        // for the Package Explorer.
        usePackageStore.getState().setFilePaths(parsed.filePaths)
        ValidationService.validateManifest(parsed.manifest, parsed.filePaths, parsed.rootFolder)

        const session = createCourseSession(assembled, parsed.items)
        sessionRef.current = session
        session.start()
      } catch (e) {
        // Drop whatever was cached for a package that never became the open one.
        if (usePackageStore.getState().package?.id !== packageId) clearSessionCache(packageId)
        logDevDiagnostic('package.load.failed', { owner, error: e instanceof Error ? e.message : String(e) })
        if (import.meta.env.DEV) console.error('[Scormite session] Failed to load package', e)
        setError(
          e instanceof Error && e.name === 'OpenPackageError'
            ? e.message
            : 'An unexpected error occurred while loading the package.',
        )
      } finally {
        loadingRef.current = false
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
