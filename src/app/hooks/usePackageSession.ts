/**
 * Owns the package session: load a package, deliver its SCOs one at a time,
 * resume or restart them, follow SCORM 2004 navigation requests, and close.
 *
 * Lives in `app/` because it needs package-loader, manifest, player,
 * runtime, and every store fed by the runtime at once. `App` subscribes
 * exactly once and passes the session to whichever mode shell is active, so
 * a running SCO survives a Basic ↔ Advanced switch.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadZip, PackageLoadError, usePackageStore } from '@/features/package-loader'
import {
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
import { runtimeEvents, useRuntimeStore } from '@/features/runtime'
import { useLogStore } from '@/features/logging'
import { useInspectorStore } from '@/features/inspector'
import { useTimelineStore } from '@/features/timeline'
import { useBreakpointStore } from '@/features/session'
import { ValidationService, useValidationStore } from '@/features/validation'
import { AttemptStore } from '@/app/course/AttemptStore'
import { CourseNavigator } from '@/app/course/CourseNavigator'
import { ScoLauncher } from '@/app/course/ScoLauncher'
import { summarizeCmi } from '@/app/course/summarizeCmi'
import { useCourseStore, type LaunchRequest } from '@/app/state/courseStore'
import type { ApiCallRecord, LaunchableItem, Package } from '@/shared/types'
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
  /** Discard every SCO's data and start the course from its first item. */
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

export function usePackageSession(owner: 'basic' | 'advanced'): PackageSession {
  const pkg = usePackageStore((s) => s.package)
  const items = useCourseStore((s) => s.items)
  const currentItemId = useCourseStore((s) => s.currentItemId)
  const pendingLaunch = useCourseStore((s) => s.pendingLaunch)
  const launchKey = useCourseStore((s) => s.launchCount)

  const [loading, setLoading] = useState(false)
  const [loadingName, setLoadingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const attempts = useRef(new AttemptStore())

  const currentItem = items.find((item) => item.identifier === currentItemId) ?? null
  const launchUrl =
    pkg && currentItem && pendingLaunch === null
      ? packageLaunchUrl(pkg.id, currentItem.launchPath)
      : null

  useEffect(() => {
    logDevDiagnostic('session.shell.mounted', { owner })
    return () => logDevDiagnostic('session.shell.unmounted', { owner })
  }, [owner])

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
    // SCORM 2004: the SCO asked the LMS to move on when it terminated.
    const unsubNav = runtimeEvents.on('navigation-request', (event) => {
      const course = useCourseStore.getState()
      const outcome = new CourseNavigator(course.items).resolve(event, course.currentItemId)
      logDevDiagnostic('session.navigation-request', { owner, ...event, outcome: outcome.kind })
      if (outcome.kind === 'launch') course.requestLaunch(outcome.itemId, 'resume')
    })
    return () => {
      unsubApi()
      unsubInit()
      unsubTerm()
      unsubNav()
    }
  }, [owner])

  // ---------------------------------------------------------------------------
  // Launching. Runs after React has committed the launch request, i.e. after
  // the previous SCO's iframe has been removed and its unload handlers have
  // already called LMSFinish/Terminate on the previous runtime.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pendingLaunch) return
    performLaunch(pendingLaunch, attempts.current)
  }, [pendingLaunch])

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
        const previous = usePackageStore.getState().package
        if (previous) clearSessionCache(previous.id)
        resetSessionStores()
        attempts.current.clear()

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

        const course = useCourseStore.getState()
        course.setItems(launchable)
        course.requestLaunch(first.identifier, 'new')
      } catch (e) {
        logDevDiagnostic('package.load.failed', { owner, error: e instanceof Error ? e.message : String(e) })
        if (import.meta.env.DEV) console.error('[Scormite session] Failed to load package', e)
        setError(loadErrorMessage(e))
      } finally {
        setLoading(false)
        setLoadingName(null)
      }
    },
    [owner],
  )

  const relaunch = useCallback(() => {
    const course = useCourseStore.getState()
    if (course.currentItemId) course.requestLaunch(course.currentItemId, 'resume')
  }, [])

  const newAttempt = useCallback(() => {
    const course = useCourseStore.getState()
    if (course.currentItemId) course.requestLaunch(course.currentItemId, 'new')
  }, [])

  const restartCourse = useCallback(() => {
    const course = useCourseStore.getState()
    const first = course.items[0]
    if (!first) return
    attempts.current.clear()
    course.clearProgress()
    course.requestLaunch(first.identifier, 'new')
  }, [])

  const close = useCallback(() => {
    const current = usePackageStore.getState().package
    logDevDiagnostic('session.close.requested', { owner, packageId: current?.id ?? null })
    if (current) clearSessionCache(current.id)
    resetSessionStores()
    attempts.current.clear()
    setError(null)
  }, [owner])

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

/**
 * Deliver one SCO: store the outgoing SCO's attempt, build a fresh runtime
 * for the incoming one (resuming its stored attempt unless a new attempt was
 * asked for), and point the player at it.
 */
function performLaunch(request: LaunchRequest, attempts: AttemptStore): void {
  const course = useCourseStore.getState()
  const pkg = usePackageStore.getState().package
  const item = course.items.find((candidate) => candidate.identifier === request.itemId)
  if (!pkg || !item) return

  const outgoing = useRuntimeStore.getState().adapter
  if (outgoing && course.currentItemId) {
    try {
      attempts.save(course.currentItemId, outgoing.exportAttempt())
    } catch {
      // An adapter that cannot render its data simply leaves nothing to resume.
    }
  }
  if (request.mode === 'new') attempts.discard(item.identifier)

  const adapter = new ScoLauncher(pkg).launch(item, attempts.get(item.identifier))
  useRuntimeStore.getState().setAdapter(adapter, pkg.scormVersion)

  // Each launch is its own replayable run; the API log spans the session.
  const cmi = adapter.getFlattenedCmi()
  useTimelineStore.getState().reset()
  useInspectorStore.getState().setBaseline(cmi)
  course.setProgress(item.identifier, summarizeCmi(cmi, pkg.scormVersion))
  course.completeLaunch(item.identifier)
  logDevDiagnostic('runtime.adapter.ready', {
    itemId: item.identifier,
    mode: request.mode,
    resumed: attempts.has(item.identifier),
    launchPath: item.launchPath,
  })
}
