/**
 * Builds the runtime for one SCO launch: a scorm-again adapter with the
 * middleware pipeline (recording, breakpoints, validation), the manifest's
 * launch data, any stored attempt to resume, and the `window.API` /
 * `window.API_1484_11` proxy the SCO finds.
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
} from '@/features/runtime'
import { useBreakpointStore } from '@/features/session'
import { useValidationStore } from '@/features/validation'
import type { LaunchableItem, Package } from '@/shared/types'

export class ScoLauncher {
  private readonly pkg: Package

  constructor(pkg: Package) {
    this.pkg = pkg
  }

  /**
   * Create and wire the adapter for `item`, resuming from `attempt` when
   * given. The returned adapter is already reachable by the SCO; the caller
   * publishes it to the runtime store and points the player at the item.
   */
  launch(item: LaunchableItem, attempt: AttemptRecord | undefined): ScormRuntimeAdapter {
    const adapter = this.createAdapter()
    this.installMiddleware(adapter)

    // What an LMS supplies before launch: the manifest's data for this
    // item, then the stored attempt (which wins where both set a value).
    adapter.seedLaunchData(item.launchData)
    if (attempt) adapter.restoreAttempt(attempt)

    injectApiProxy(adapter, this.pkg.scormVersion)
    return adapter
  }

  private createAdapter(): ScormRuntimeAdapter {
    return this.pkg.scormVersion === '1.2'
      ? new Scorm12Adapter(this.pkg.id)
      : new Scorm2004Adapter(this.pkg.id)
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
      }),
    )
  }
}
