/**
 * Shown over the player once the running SCO has called Terminate /
 * LMSFinish: on a real LMS that is where the player closes the SCO or moves
 * on, so the tester gets the same choices — resume it, start it over, or go
 * to the next item.
 */

import { ChevronRight, RotateCcw, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRuntimeStore } from '@/features/runtime'
import { useCourseStore } from '@/app/state/courseStore'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { CourseNavigator } from './CourseNavigator'

export function ScoEndedBar({ session }: { session: PackageSession }) {
  const isTerminated = useRuntimeStore((s) => s.isTerminated)
  const items = useCourseStore((s) => s.items)
  const requestLaunch = useCourseStore((s) => s.requestLaunch)

  if (!isTerminated || session.launchUrl === null || !session.currentItem) return null
  const next = new CourseNavigator(items).next(session.currentItem.identifier)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-900 px-3 py-1.5 text-xs shadow-lg"
      >
        <span className="min-w-0 truncate text-slate-300">
          <span className="text-slate-500">Session ended · </span>
          {session.currentItem.title}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={session.relaunch} title="Relaunch with the saved data (entry = resume after a suspend)">
            <Play aria-hidden />
            Relaunch
          </Button>
          <Button size="sm" variant="ghost" onClick={session.newAttempt} title="Discard this item's data and launch it fresh">
            <RotateCcw aria-hidden />
            New attempt
          </Button>
          {next && (
            <Button size="sm" onClick={() => requestLaunch(next.identifier)} title={`Next: ${next.title}`}>
              Next
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
