/**
 * Builds SCO runtimes: a scorm-again adapter with the middleware pipeline
 * (recording, breakpoints, validation) — optionally driven by the SCORM 2004
 * sequencing engine — and, per delivered SCO, the manifest's launch data,
 * any stored attempt to resume, and the `window.API` / `window.API_1484_11`
 * proxy the SCO finds.
 *
 * Lives in `app/` because it joins runtime, session, validation, and
 * player — no single feature may import the others.
 */

import { injectApiProxy } from '@/features/player'
import {
  createBreakpointMiddleware,
  createValidationMiddleware,
  recordingMiddleware,
  Scorm12Adapter,
  Scorm2004Adapter,
  type AttemptRecord,
  type ScormRuntimeAdapter,
  type SequencingOptions,
} from '@/features/runtime'
import { useBreakpointStore } from '@/features/session'
import { useLearnerStore } from '@/features/learner'
import { useValidationStore } from '@/features/validation'
import type { LaunchableItem, Package } from '@/shared/types'

export class ScoLauncher {
  private readonly pkg: Package
  private engines = 0

  constructor(pkg: Package) {
    this.pkg = pkg
  }

  /** A fresh runtime for one SCO launch, in manifest-order (flow) mode. */
  createRuntime(): ScormRuntimeAdapter {
    const adapter =
      this.pkg.scormVersion === '1.2' ? new Scorm12Adapter(this.pkg.id) : new Scorm2004Adapter(this.pkg.id)
    this.installMiddleware(adapter)
    return adapter
  }

  /**
   * One SCORM 2004 runtime for the whole course, driven by scorm-again's
   * sequencing engine; reused for every SCO it delivers.
   */
  createSequencedRuntime(sequencing: SequencingOptions): Scorm2004Adapter {
    // A distinct session id per engine, so events from a replaced engine (a
    // course restart) can be told apart from the current one's.
    this.engines += 1
    const adapter = new Scorm2004Adapter(`${this.pkg.id}#${this.engines}`, undefined, sequencing)
    this.installMiddleware(adapter)
    return adapter
  }

  /**
   * Prepare `adapter` for `item`: what an LMS supplies before launch — the
   * manifest's data for the item, then the stored attempt (which wins where
   * both set a value) — and expose it to the SCO.
   */
  deliver(adapter: ScormRuntimeAdapter, item: LaunchableItem, attempt: AttemptRecord | undefined): void {
    adapter.seedLaunchData(item.launchData)
    if (attempt) adapter.restoreAttempt(attempt)
    const { id, name } = useLearnerStore.getState()
    adapter.seedLearner({ id, name })
    injectApiProxy(adapter, this.pkg.scormVersion)
  }

  private installMiddleware(adapter: ScormRuntimeAdapter): void {
    adapter.addMiddleware(recordingMiddleware)

    // Breakpoints pause matching calls *before* they reach scorm-again. The
    // middleware only signals; the adapter owns the gate, and the
    // breakpoint store mirrors the pause state for the UI.
    const breakpoints = useBreakpointStore.getState()
    breakpoints.setPausedFlag(false)
    adapter.addMiddleware(
      createBreakpointMiddleware({
        getBreakpoints: () => useBreakpointStore.getState().breakpoints,
        onHit: (hit) => useBreakpointStore.getState().recordHit(hit),
      }),
    )
    adapter.onPauseChange((paused) => useBreakpointStore.getState().setPausedFlag(paused))
    breakpoints.setResumeHandler(() => adapter.resume())

    // Runtime validation runs on every completed call.
    adapter.addMiddleware(
      createValidationMiddleware({
        scormVersion: this.pkg.scormVersion,
        ...(this.pkg.scormEdition !== undefined ? { scormEdition: this.pkg.scormEdition } : {}),
        onIssue: (issue) => useValidationStore.getState().addIssue(issue),
        readCmi: () => adapter.getFlattenedCmi(),
      }),
    )
  }
}
