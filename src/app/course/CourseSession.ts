/**
 * One open package, played the way an LMS plays it.
 *
 * - SCORM 2004 courses run on a single runtime driven by scorm-again's
 *   sequencing engine: the engine decides which SCO to deliver (start,
 *   continue, previous, choice, SCO-initiated requests, rules, rollup) and
 *   this class delivers it.
 * - SCORM 1.2 courses — and 2004 courses the engine cannot start — run in
 *   flow mode: a fresh runtime per SCO, navigation in manifest order.
 *
 * Either way each SCO's attempt is stored when it is left and restored when
 * it is resumed. The class publishes to the app stores; React only asks for
 * launches and navigation through `useCourseStore`.
 */

import {
  runtimeEvents,
  useRuntimeStore,
  type ScormRuntimeAdapter,
  type Scorm2004Adapter,
  type SequencingOptions,
} from '@/features/runtime'
import { useInspectorStore } from '@/features/inspector'
import { useTimelineStore } from '@/features/timeline'
import { useValidationStore } from '@/features/validation'
import type { LaunchableItem, Package, ValidationIssue } from '@/shared/types'
import {
  useCourseStore,
  type LaunchMode,
  type LaunchRequest,
  type NavigationIntent,
} from '@/app/state/courseStore'
import { AttemptStore } from './AttemptStore'
import { CourseNavigator } from './CourseNavigator'
import { ScoLauncher } from './ScoLauncher'
import type { SessionPersistence, SessionSnapshot } from './SessionPersistence'
import { summarizeCmi, type CmiSummary } from './summarizeCmi'

const ENGINE_STATUS_UNKNOWN = new Set(['unknown', ''])

function issue(
  partial: Pick<ValidationIssue, 'severity' | 'source' | 'message' | 'ruleId'> & { location?: string },
): ValidationIssue {
  return { id: crypto.randomUUID(), ...partial }
}

export class CourseSession {
  readonly pkg: Package
  private readonly items: readonly LaunchableItem[]
  private readonly navigator: CourseNavigator
  private readonly launcher: ScoLauncher
  private readonly attempts = new AttemptStore()
  private readonly sequencing: SequencingOptions | null
  private engine: Scorm2004Adapter | null = null
  /** How the engine's next delivery should be launched. */
  private nextDeliveryMode: LaunchMode = 'resume'
  /** True while this session itself is asking the engine to navigate. */
  private navigating = false
  private readonly unsubscribers: (() => void)[] = []
  private readonly persistence: SessionPersistence | null
  /** Progress saved by an earlier visit, used by the first start only. */
  private saved: SessionSnapshot | null

  constructor(
    pkg: Package,
    items: readonly LaunchableItem[],
    sequencing: SequencingOptions | null,
    persistence: SessionPersistence | null = null,
    saved: SessionSnapshot | null = null,
  ) {
    this.pkg = pkg
    this.items = items
    this.navigator = new CourseNavigator(items)
    this.launcher = new ScoLauncher(pkg)
    this.sequencing = sequencing
    this.persistence = persistence
    this.saved = saved
    this.subscribe()
  }

  get isSequenced(): boolean {
    return this.engine !== null
  }

  /** Begin the course: the engine's `start`, or the first item in flow mode. */
  start(): void {
    const course = useCourseStore.getState()
    course.setCourse([...this.items], false)

    // Saved progress from an earlier visit: restore the attempts and resume
    // where the learner was, as an LMS does when a course is reopened.
    const saved = this.saved
    this.saved = null
    if (saved) {
      this.attempts.load(saved.attempts)
      course.mergeProgress(saved.progress)
    }
    const savedItem = this.navigator.find(saved?.currentItemId)

    if (this.sequencing && this.startEngine(this.sequencing, saved && savedItem ? { item: savedItem.identifier, state: saved.sequencingState } : null)) {
      if (saved) this.announceResume(saved)
      return
    }
    const first = savedItem ?? this.navigator.first
    if (!first) return
    course.requestLaunch(first.identifier, saved ? 'resume' : 'new')
    if (saved) this.announceResume(saved)
  }

  private announceResume(saved: SessionSnapshot): void {
    const when = new Date(saved.savedAt).toLocaleString()
    useCourseStore
      .getState()
      .setNotice(`Resumed the progress saved in this browser on ${when}. Restart › Restart whole course starts fresh.`, 'info')
  }

  /**
   * Save progress so a reload resumes here: every stored attempt plus the
   * running SCO's live data, per-item progress, the current item, and the
   * sequencing engine's state.
   */
  persist({ immediate = false }: { immediate?: boolean } = {}): void {
    if (!this.persistence) return
    const course = useCourseStore.getState()
    const attempts = this.attempts.toRecord()
    const live = useRuntimeStore.getState().adapter
    if (live && course.currentItemId) {
      try {
        attempts[course.currentItemId] = live.exportAttempt()
      } catch {
        // Keep the last stored attempt for this item.
      }
    }
    const sequencingState = this.engine?.serializeSequencingState() ?? null
    this.persistence.saveSoon({
      version: 1,
      savedAt: Date.now(),
      currentItemId: course.currentItemId,
      attempts,
      progress: course.progress,
      ...(sequencingState !== null ? { sequencingState } : {}),
    })
    if (immediate) void this.persistence.flush()
  }

  /** Discard every attempt and start over (a fresh engine for 2004). */
  restart(): void {
    void this.persistence?.clear()
    this.attempts.clear()
    this.engine = null
    useCourseStore.getState().clearProgress()
    this.start()
  }

  /**
   * Deliver one item. Runs after the previous SCO's iframe is gone: the
   * outgoing attempt is stored, the runtime is prepared (a fresh one in flow
   * mode, the engine's reset otherwise), and the incoming attempt restored.
   */
  deliver(request: LaunchRequest): void {
    const course = useCourseStore.getState()
    const item = this.items.find((candidate) => candidate.identifier === request.itemId)
    if (!item) {
      course.completeNavigation()
      return
    }

    const outgoing = useRuntimeStore.getState().adapter
    // Calls a breakpoint is holding belong to the SCO being left; applying
    // them later would write its data into the next SCO's runtime.
    outgoing?.discardHeldCalls()
    if (outgoing && course.currentItemId) {
      try {
        this.attempts.save(course.currentItemId, outgoing.exportAttempt())
      } catch {
        // An adapter that cannot render its data leaves nothing to resume.
      }
    }
    if (request.mode === 'new') this.attempts.discard(item.identifier)

    let adapter: ScormRuntimeAdapter
    if (this.engine) {
      this.engine.prepareForDelivery()
      adapter = this.engine
    } else {
      adapter = this.launcher.createRuntime()
    }
    this.launcher.deliver(adapter, item, this.attempts.get(item.identifier))
    useRuntimeStore.getState().setAdapter(adapter, this.pkg.scormVersion)

    // Each delivery is its own replayable run; the API log spans the session.
    const cmi = adapter.getFlattenedCmi()
    useTimelineStore.getState().reset()
    useInspectorStore.getState().setBaseline(cmi)
    course.setProgress(item.identifier, summarizeCmi(cmi, this.pkg.scormVersion))
    course.completeLaunch(item.identifier)
    course.setEnded(null)
    this.refresh()
    this.persist({ immediate: true })
  }

  /**
   * Hand a learner navigation (outline, Previous / Next) to the engine.
   * Runs after the current SCO's iframe is gone. When the engine refuses,
   * the current SCO is delivered again so the learner is never left with an
   * empty player.
   */
  navigate(intent: NavigationIntent): void {
    const course = useCourseStore.getState()
    const engine = this.engine
    if (!engine) {
      course.completeNavigation()
      return
    }
    this.nextDeliveryMode = intent.mode
    this.engineNavigate(engine, intent.request, intent.targetId)

    // Re-read: the engine may have delivered an activity or ended the course.
    const after = useCourseStore.getState()
    if (after.pendingLaunch) return
    this.nextDeliveryMode = 'resume'
    if (after.endedReason) {
      after.completeNavigation()
      return
    }
    const label = intent.request === 'choice' ? `"${this.navigator.find(intent.targetId)?.title ?? intent.targetId}"` : intent.request
    after.setNotice(`The course's sequencing rules do not allow ${label} right now.`)
    if (after.currentItemId) after.requestLaunch(after.currentItemId, 'resume')
    else after.completeNavigation()
  }

  /**
   * Re-read what the engine allows and its view of every activity's status.
   * Call after deliveries and after calls that change tracking data.
   */
  refresh(): void {
    const course = useCourseStore.getState()
    const engine = this.engine
    // Flow mode's availability is derived from the item order where it is shown.
    if (!engine) return
    const state = engine.navigationState()
    const navigation = state
      ? { canContinue: state.canContinue, canPrevious: state.canPrevious, choices: state.choices, hiddenControls: state.hiddenControls }
      : { canContinue: false, canPrevious: false, choices: [], hiddenControls: [] }
    if (JSON.stringify(navigation) !== JSON.stringify(course.navigation)) course.setNavigation(navigation)

    // The engine's rolled-up status is what its rules act on; show it for
    // every item other than the running one (whose live CMI is richer).
    const progress: Record<string, CmiSummary> = {}
    for (const item of this.items) {
      if (item.identifier === course.currentItemId) continue
      const status = engine.activityStatus(item.identifier)
      if (!status) continue
      const known = course.progress[item.identifier]
      if (ENGINE_STATUS_UNKNOWN.has(status.completionStatus) && !known) continue
      const next: CmiSummary = {
        completionStatus: ENGINE_STATUS_UNKNOWN.has(status.completionStatus)
          ? (known?.completionStatus ?? 'not attempted')
          : status.completionStatus,
        successStatus: status.successStatus || 'unknown',
        score: known?.score ?? '',
        location: known?.location ?? '',
        time: known?.time ?? '',
      }
      if (!known || known.completionStatus !== next.completionStatus || known.successStatus !== next.successStatus) {
        progress[item.identifier] = next
      }
    }
    if (Object.keys(progress).length > 0) course.mergeProgress(progress)
  }

  /** Write any pending save now (the page is being hidden). */
  flushSaves(): Promise<void> {
    return this.persistence?.flush() ?? Promise.resolve()
  }

  /** Stop listening to the runtime. The session is unusable afterwards. */
  dispose(): void {
    void this.persistence?.flush()
    for (const off of this.unsubscribers.splice(0)) off()
    this.engine = null
  }

  private engineNavigate(engine: Scorm2004Adapter, request: Parameters<Scorm2004Adapter['navigate']>[0], targetId?: string): void {
    this.navigating = true
    try {
      engine.navigate(request, targetId)
    } finally {
      this.navigating = false
    }
  }

  private startEngine(sequencing: SequencingOptions, resume: { item: string; state: string | undefined } | null): boolean {
    const course = useCourseStore.getState()
    const validation = useValidationStore.getState()
    if (resume?.state && this.resumeEngine(sequencing, resume.item, resume.state)) return true
    const engine = this.launcher.createSequencedRuntime(sequencing)
    this.reportSequencingWarnings(engine)
    this.engine = engine
    course.setSequenced(true)
    useRuntimeStore.getState().setAdapter(engine, '2004')
    this.nextDeliveryMode = 'new'
    this.engineNavigate(engine, 'start')
    if (useCourseStore.getState().pendingLaunch) return true

    this.engine = null
    course.setSequenced(false)
    validation.addIssue(
      issue({
        severity: 'warning',
        source: 'manifest',
        ruleId: 'sequencing.start-failed',
        message:
          'The sequencing engine could not start this course with the declared rules; it is played in manifest order instead.',
      }),
    )
    return false
  }

  /** Report what the engine will not evaluate; a new engine's warnings replace earlier ones. */
  private reportSequencingWarnings(engine: Scorm2004Adapter): void {
    useValidationStore.setState((state) => ({
      issues: state.issues.filter((i) => !(i.source === 'manifest' && i.ruleId.startsWith('sequencing.'))),
    }))
    useValidationStore.getState().addIssues(
      engine.sequencingWarnings.map((message) =>
        issue({ severity: 'warning', source: 'manifest', ruleId: 'sequencing.unsupported', message }),
      ),
    )
  }

  /**
   * Rebuild the engine from saved state and return to the saved item. When
   * the saved state no longer applies, the caller starts a fresh engine.
   */
  private resumeEngine(sequencing: SequencingOptions, itemId: string, state: string): boolean {
    const engine = this.launcher.createSequencedRuntime(sequencing)
    if (!engine.restoreSequencingState(state)) return false
    this.reportSequencingWarnings(engine)
    this.engine = engine
    useCourseStore.getState().setSequenced(true)
    useRuntimeStore.getState().setAdapter(engine, '2004')
    this.nextDeliveryMode = 'resume'
    this.engineNavigate(engine, 'choice', itemId)
    if (useCourseStore.getState().pendingLaunch) return true
    this.engine = null
    return false
  }

  private subscribe(): void {
    const fromEngine = (sessionId: string) => this.engine !== null && sessionId === this.engine.sessionId
    this.unsubscribers.push(
      runtimeEvents.on('activity-delivered', (event) => {
        if (!fromEngine(event.sessionId)) return
        const course = useCourseStore.getState()
        // The unloading SCO's own navigation request was processed while the
        // learner's request waits: the learner's explicit choice wins; a
        // relative continue / previous yields to the SCO's delivery.
        if (!this.navigating && course.pendingNavigation) {
          if (course.pendingNavigation.request === 'choice') return
          course.completeNavigation()
        }
        course.requestLaunch(event.activityId, this.nextDeliveryMode)
        this.nextDeliveryMode = 'resume'
      }),
      runtimeEvents.on('sequencing-session-end', (event) => {
        if (!fromEngine(event.sessionId)) return
        useCourseStore.getState().setEnded(event.reason)
        this.refresh()
      }),
      runtimeEvents.on('sequencing-error', (event) => {
        if (!fromEngine(event.sessionId)) return
        useValidationStore.getState().addIssue(
          issue({
            severity: 'warning',
            source: 'runtime',
            ruleId: 'sequencing.request-refused',
            location: 'adl.nav.request',
            message: event.message,
          }),
        )
      }),
      // Flow mode: the SCO asked the LMS to move on when it terminated.
      runtimeEvents.on('navigation-request', (event) => {
        if (event.sessionId !== this.pkg.id || this.engine) return
        const course = useCourseStore.getState()
        // The learner already chose where to go; the unloading SCO's request is moot.
        if (course.pendingLaunch || course.pendingNavigation) return
        const outcome = this.navigator.resolve(event, course.currentItemId)
        if (outcome.kind === 'launch') course.requestLaunch(outcome.itemId, 'resume')
        if (outcome.kind === 'end') course.setEnded(event.request)
      }),
    )
  }
}
