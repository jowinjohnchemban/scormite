/**
 * Flow navigation over a course's launchable items, and the LMS's answer to
 * a SCORM 2004 navigation request.
 *
 * scorm-again parses `adl.nav.request` and raises it; deciding *which SCO to
 * deliver next* is the LMS's job. This class does that for flow order
 * (continue / previous) and direct targets (choice / jump).
 */

import type { LaunchableItem } from '@/shared/types'
import type { NavigationRequestEvent } from '@/features/runtime'

export type NavigationOutcome =
  /** Deliver this item next. */
  | { kind: 'launch'; itemId: string }
  /** The learner left the course (exitAll / abandonAll / continue past the end). */
  | { kind: 'end' }
  /** Nothing to deliver — the request is not satisfiable here. */
  | { kind: 'none' }

export class CourseNavigator {
  private readonly items: readonly LaunchableItem[]

  constructor(items: readonly LaunchableItem[]) {
    this.items = items
  }

  get first(): LaunchableItem | undefined {
    return this.items[0]
  }

  find(itemId: string | null | undefined): LaunchableItem | undefined {
    return itemId ? this.items.find((item) => item.identifier === itemId) : undefined
  }

  next(currentId: string | null): LaunchableItem | undefined {
    const index = this.indexOf(currentId)
    return index < 0 ? undefined : this.items[index + 1]
  }

  previous(currentId: string | null): LaunchableItem | undefined {
    const index = this.indexOf(currentId)
    return index <= 0 ? undefined : this.items[index - 1]
  }

  /** Position for display, 1-based, or 0 when the item is unknown. */
  position(currentId: string | null): number {
    return this.indexOf(currentId) + 1
  }

  get size(): number {
    return this.items.length
  }

  resolve(event: Pick<NavigationRequestEvent, 'request' | 'target'>, currentId: string | null): NavigationOutcome {
    switch (event.request) {
      case 'continue': {
        const next = this.next(currentId)
        return next ? { kind: 'launch', itemId: next.identifier } : { kind: 'end' }
      }
      case 'previous': {
        const previous = this.previous(currentId)
        return previous ? { kind: 'launch', itemId: previous.identifier } : { kind: 'none' }
      }
      case 'choice':
      case 'jump': {
        const target = this.find(event.target)
        return target ? { kind: 'launch', itemId: target.identifier } : { kind: 'none' }
      }
      case 'exitAll':
      case 'abandonAll':
        return { kind: 'end' }
      case 'exit':
      case 'abandon':
        // The SCO left its own activity without asking for another one; the
        // learner picks what comes next from the outline.
        return { kind: 'none' }
    }
  }

  private indexOf(itemId: string | null): number {
    return itemId ? this.items.findIndex((item) => item.identifier === itemId) : -1
  }
}
