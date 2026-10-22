/**
 * Shown over the player once the running SCO has terminated, or the whole
 * course has ended: on a real LMS that is where the player closes the SCO or
 * moves on, so the tester gets the same choices — resume, start over, or go
 * to the next item.
 */

import { ChevronRight, ListRestart, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRuntimeStore } from '@/features/runtime'
import { flowAvailability, useCourseStore } from '@/app/state/courseStore'
import type { PackageSession } from '@/app/hooks/usePackageSession'

const END_REASONS: Readonly<Record<string, string>> = {
  exitAll: 'The course exited',
  suspendAll: 'The course was suspended',
  abandonAll: 'The course was abandoned',
  continue: 'End of the course reached',
}

export function ScoEndedBar({ session }: { session: PackageSession }) {
  const isTerminated = useRuntimeStore((s) => s.isTerminated)
  const items = useCourseStore((s) => s.items)
  const sequenced = useCourseStore((s) => s.sequenced)
  const engineNavigation = useCourseStore((s) => s.navigation)
  const endedReason = useCourseStore((s) => s.endedReason)
  const go = useCourseStore((s) => s.go)

  const current = session.currentItem
  if (!current) return null
  // A terminated SCO is still on screen; an ended course has nothing playing.
  if (endedReason === null && (!isTerminated || session.launchUrl === null)) return null

  const navigation = sequenced ? engineNavigation : flowAvailability(items, current.identifier)
  const courseEnded = endedReason !== null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border-subtle bg-surface-900 px-3 py-1.5 text-xs shadow-lg"
      >
        <span className="min-w-0 truncate text-slate-300">
          {courseEnded ? (
            <span>{END_REASONS[endedReason] ?? `The course ended (${endedReason})`}</span>
          ) : (
            <>
              <span className="text-slate-500">Session ended · </span>
              {current.title}
            </>
          )}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={session.relaunch}
            title="Relaunch with the saved data (entry = resume after a suspend)"
          >
            <Play aria-hidden />
            Relaunch
          </Button>
          {courseEnded ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={session.restartCourse}
              title="Discard all data and start the course again"
            >
              <ListRestart aria-hidden />
              Restart course
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={session.newAttempt}
              title="Discard this item's data and launch it fresh"
            >
              <RotateCcw aria-hidden />
              New attempt
            </Button>
          )}
          {!courseEnded &&
            items.length > 1 &&
            navigation.canContinue &&
            !navigation.hiddenControls.includes('continue') && (
              <Button size="sm" onClick={() => go({ request: 'continue', mode: 'resume' })}>
                Next
                <ChevronRight aria-hidden />
              </Button>
            )}
        </div>
      </div>
    </div>
  )
}
