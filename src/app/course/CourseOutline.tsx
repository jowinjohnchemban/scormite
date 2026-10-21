/**
 * The course's launchable items, in flow order, with each one's progress.
 * Choosing an item or Previous / Next navigates through the course store:
 * in manifest order for SCORM 1.2, through the sequencing engine for SCORM
 * 2004 — where items the course's rules do not allow right now are shown
 * disabled. Used in Basic mode's sidebar and as the Advanced "Outline" panel.
 */

import { ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, CircleX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { flowAvailability, useCourseStore } from '@/app/state/courseStore'
import { CourseNavigator } from './CourseNavigator'
import { progressTone, type ProgressTone } from './summarizeCmi'

const TONE: Record<ProgressTone, { icon: LucideIcon; className: string; label: string }> = {
  passed: { icon: CircleCheck, className: 'text-success', label: 'Passed' },
  completed: { icon: CircleCheck, className: 'text-success', label: 'Completed' },
  failed: { icon: CircleX, className: 'text-danger', label: 'Failed' },
  'in-progress': { icon: CircleDot, className: 'text-warning', label: 'In progress' },
  'not-started': { icon: Circle, className: 'text-slate-600', label: 'Not started' },
}

const NOT_ALLOWED = "Not available now — the course's sequencing rules don't allow choosing it"

/** The Advanced-mode dock panel: the outline filling its panel. */
export function CourseOutlinePanel() {
  return <CourseOutline className="h-full" />
}

export function CourseOutline({ className }: { className?: string }) {
  const items = useCourseStore((s) => s.items)
  const sequenced = useCourseStore((s) => s.sequenced)
  const engineNavigation = useCourseStore((s) => s.navigation)
  const currentItemId = useCourseStore((s) => s.currentItemId)
  const pendingItemId = useCourseStore((s) => s.pendingLaunch?.itemId ?? null)
  const busy = useCourseStore((s) => s.pendingLaunch !== null || s.pendingNavigation !== null)
  const progress = useCourseStore((s) => s.progress)
  const go = useCourseStore((s) => s.go)

  if (items.length === 0) {
    return <p className="p-3 text-xs text-slate-600">No course loaded.</p>
  }

  const navigator = new CourseNavigator(items)
  const navigation = sequenced ? engineNavigation : flowAvailability(items, currentItemId)
  const previous = navigator.previous(currentItemId)
  const next = navigator.next(currentItemId)
  const position = navigator.position(currentItemId)
  const showPrevious = !navigation.hiddenControls.includes('previous')
  const showNext = !navigation.hiddenControls.includes('continue')

  return (
    <section aria-label="Course outline" className={cn('flex min-h-0 flex-col', className)}>
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-900 px-2">
        <span className="truncate text-[11px] text-slate-500">
          {items.length === 1 ? '1 item' : `Item ${position || '–'} of ${items.length}`}
          {sequenced && <span title="Navigation is decided by the course's SCORM 2004 sequencing rules"> · sequenced</span>}
        </span>
        {items.length > 1 && (
          <div className="flex shrink-0 items-center gap-0.5">
            {showPrevious && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6"
                aria-label="Previous item"
                title={navigation.canPrevious ? `Previous${!sequenced && previous ? `: ${previous.title}` : ''}` : 'No previous item available'}
                disabled={busy || !navigation.canPrevious}
                onClick={() => go({ request: 'previous', mode: 'resume' })}
              >
                <ChevronLeft aria-hidden />
              </Button>
            )}
            {showNext && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 lg:size-6"
                aria-label="Next item"
                title={navigation.canContinue ? `Next${!sequenced && next ? `: ${next.title}` : ''}` : 'No next item available'}
                disabled={busy || !navigation.canContinue}
                onClick={() => go({ request: 'continue', mode: 'resume' })}
              >
                <ChevronRight aria-hidden />
              </Button>
            )}
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
          const allowed = isCurrent || navigation.choices === null || navigation.choices.includes(item.identifier)
          return (
            <li key={item.identifier}>
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={busy || !allowed}
                title={`${item.title} — ${tone.label}${summary?.score ? ` · score ${summary.score}` : ''}${allowed ? '' : `\n${NOT_ALLOWED}`}\n${item.launchPath}`}
                onClick={() => go({ request: 'choice', targetId: item.identifier, mode: 'resume' })}
                className={cn(
                  'flex w-full items-center gap-2 py-1.5 pr-2 text-left text-xs transition-colors lg:py-1',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
                  'disabled:cursor-not-allowed',
                  isCurrent
                    ? 'bg-surface-700 text-slate-100'
                    : allowed
                      ? 'text-slate-300 hover:bg-surface-800'
                      : 'text-slate-600',
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
