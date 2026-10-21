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
  flowAvailability,
  useCourseStore,
  type LaunchMode,
  type LaunchRequest,
  type NavigationIntent,
} from '@/app/state/courseStore'
import { AttemptStore } from './AttemptStore'
import { CourseNavigator } from './CourseNavigator'
import { ScoLauncher } from './ScoLauncher'
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
  private readonly unsubscribers: (() => void)[] = []

  constructor(pkg: Package, items: readonly LaunchableItem[], sequencing: SequencingOptions | null) {
    this.pkg = pkg
    this.items = items
    this.navigator = new CourseNavigator(items)
    this.launcher = new ScoLauncher(pkg)
    this.sequencing = sequencing
    this.subscribe()
  }

  get isSequenced(): boolean {
    return this.engine !== null
  }

  /** Begin the course: the engine's `start`, or the first item in flow mode. */
  start(): void {
    const course = useCourseStore.getState()
    course.setCourse([...this.items], false)
    if (this.sequencing && this.startEngine(this.sequencing)) return
    const first = this.navigator.first
    if (first) course.requestLaunch(first.identifier, 'new')
  }

  /** Discard every attempt and start over (a fresh engine for 2004). */
  restart(): void {
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
    engine.navigate(intent.request, intent.targetId)
    if (useCourseStore.getState().pendingLaunch) return

    this.nextDeliveryMode = 'resume'
    const label = intent.request === 'choice' ? `"${this.navigator.find(intent.targetId)?.title ?? intent.targetId}"` : intent.request
    course.setNotice(`The course's sequencing rules do not allow ${label} right now.`)
    if (course.currentItemId && !course.endedReason) course.requestLaunch(course.currentItemId, 'resume')
    else course.completeNavigation()
  }

  /**
   * Re-read what the engine allows and its view of every activity's status.
   * Call after deliveries and after calls that change tracking data.
   */
  refresh(): void {
    const course = useCourseStore.getState()
    const engine = this.engine
    if (!engine) {
      course.setNavigation(flowAvailability([...this.items], course.currentItemId))
      return
    }
    const state = engine.navigationState()
    course.setNavigation(
      state
        ? {
            canContinue: state.canContinue,
            canPrevious: state.canPrevious,
            choices: state.choices,
            hiddenControls: state.hiddenControls,
          }
        : { canContinue: false, canPrevious: false, choices: [], hiddenControls: [] },
    )

    // The engine's rolled-up status is what its rules act on; show it for
    // every item other than the running one (whose live CMI is richer).
    const progress: Record<string, CmiSummary> = {}
    for (const item of this.items) {
      if (item.identifier === course.currentItemId) continue
      const status = engine.activityStatus(item.identifier)
      if (!status) continue
      const known = course.progress[item.identifier]
      if (ENGINE_STATUS_UNKNOWN.has(status.completionStatus) && !known) continue
      progress[item.identifier] = {
        completionStatus: ENGINE_STATUS_UNKNOWN.has(status.completionStatus)
          ? (known?.completionStatus ?? 'not attempted')
          : status.completionStatus,
        successStatus: status.successStatus || 'unknown',
        score: known?.score ?? '',
        location: known?.location ?? '',
        time: known?.time ?? '',
      }
    }
    course.mergeProgress(progress)
  }

  /** Stop listening to the runtime. The session is unusable afterwards. */
  dispose(): void {
    for (const off of this.unsubscribers.splice(0)) off()
    this.engine = null
  }

  private startEngine(sequencing: SequencingOptions): boolean {
    const course = useCourseStore.getState()
    const validation = useValidationStore.getState()
    const engine = this.launcher.createSequencedRuntime(sequencing)
    validation.addIssues(
      engine.sequencingWarnings.map((message) =>
        issue({ severity: 'warning', source: 'manifest', ruleId: 'sequencing.unsupported', message }),
      ),
    )
    this.engine = engine
    course.setSequenced(true)
    useRuntimeStore.getState().setAdapter(engine, '2004')
    this.nextDeliveryMode = 'new'
    engine.navigate('start')
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

  private subscribe(): void {
    const fromEngine = (sessionId: string) => this.engine !== null && sessionId === this.engine.sessionId
    this.unsubscribers.push(
      runtimeEvents.on('activity-delivered', (event) => {
        if (!fromEngine(event.sessionId)) return
        useCourseStore.getState().requestLaunch(event.activityId, this.nextDeliveryMode)
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
        const outcome = this.navigator.resolve(event, course.currentItemId)
        if (outcome.kind === 'launch') course.requestLaunch(outcome.itemId, 'resume')
        if (outcome.kind === 'end') course.setEnded(event.request)
      }),
    )
  }
}
