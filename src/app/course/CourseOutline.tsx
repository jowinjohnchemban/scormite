/**
 * The course's launchable items, in flow order, with each one's progress.
 * Clicking an item delivers it (resuming its stored data); Previous / Next
 * step through the flow. Used in Basic mode's sidebar and as the Advanced
 * mode "Outline" dock panel.
 */

import { ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, CircleX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useCourseStore } from '@/app/state/courseStore'
import { CourseNavigator } from './CourseNavigator'
import { progressTone, type ProgressTone } from './summarizeCmi'

const TONE: Record<ProgressTone, { icon: LucideIcon; className: string; label: string }> = {
  passed: { icon: CircleCheck, className: 'text-success', label: 'Passed' },
  completed: { icon: CircleCheck, className: 'text-success', label: 'Completed' },
  failed: { icon: CircleX, className: 'text-danger', label: 'Failed' },
  'in-progress': { icon: CircleDot, className: 'text-warning', label: 'In progress' },
  'not-started': { icon: Circle, className: 'text-slate-600', label: 'Not started' },
}

/** The Advanced-mode dock panel: the outline filling its panel. */
export function CourseOutlinePanel() {
  return <CourseOutline className="h-full" />
}

export function CourseOutline({ className }: { className?: string }) {
  const items = useCourseStore((s) => s.items)
  const currentItemId = useCourseStore((s) => s.currentItemId)
  const pendingItemId = useCourseStore((s) => s.pendingLaunch?.itemId ?? null)
  const progress = useCourseStore((s) => s.progress)
  const requestLaunch = useCourseStore((s) => s.requestLaunch)

  if (items.length === 0) {
    return <p className="p-3 text-xs text-slate-600">No course loaded.</p>
  }

  const navigator = new CourseNavigator(items)
  const previous = navigator.previous(currentItemId)
  const next = navigator.next(currentItemId)
  const position = navigator.position(currentItemId)

  return (
    <section aria-label="Course outline" className={cn('flex min-h-0 flex-col', className)}>
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-900 px-2">
        <span className="text-[11px] text-slate-500">
          {items.length === 1 ? '1 item' : `Item ${position || '–'} of ${items.length}`}
        </span>
        {items.length > 1 && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Previous item"
              title={previous ? `Previous: ${previous.title}` : 'No previous item'}
              disabled={!previous}
              onClick={() => previous && requestLaunch(previous.identifier)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Next item"
              title={next ? `Next: ${next.title}` : 'No next item'}
              disabled={!next}
              onClick={() => next && requestLaunch(next.identifier)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </header>

      <ol
        tabIndex={0}
        aria-label="Course items"
        className="min-h-0 flex-1 overflow-y-auto py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {items.map((item) => {
          const summary = progress[item.identifier]
          const tone = TONE[progressTone(summary)]
          const Icon = tone.icon
          const isCurrent = item.identifier === currentItemId
          const isPending = item.identifier === pendingItemId
          return (
            <li key={item.identifier}>
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                title={`${item.title} — ${tone.label}${summary?.score ? ` · score ${summary.score}` : ''}\n${item.launchPath}`}
                onClick={() => requestLaunch(item.identifier)}
                className={cn(
                  'flex w-full items-center gap-2 py-1 pr-2 text-left text-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
                  isCurrent
                    ? 'bg-surface-700 text-slate-100'
                    : 'text-slate-300 hover:bg-surface-800',
                )}
                style={{ paddingLeft: `${8 + item.depth * 12}px` }}
              >
                <Icon aria-hidden className={cn('size-3.5 shrink-0', tone.className, isPending && 'animate-pulse')} />
                <span className="sr-only">{tone.label}: </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.scormType === 'asset' && (
                  <span className="shrink-0 rounded bg-slate-600/40 px-1 text-[10px] text-slate-400">asset</span>
                )}
                {summary?.score && (
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">{summary.score}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
