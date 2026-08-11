import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/features/timeline/state/timelineStore'
import { cn } from '@/shared/lib/utils'

function timestamp(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  })
}

function changedSummary(paths: string[]): string {
  if (paths.length === 0) return 'no fields changed'
  if (paths.length <= 3) return paths.join(', ')
  return `${paths.slice(0, 3).join(', ')} +${paths.length - 3} more`
}

/**
 * Scrubs recorded CMI snapshots; it never changes the running SCO.
 * While the cursor is set, the CMI Inspector shows the state at that instant.
 */
export function TimelinePanel() {
  const snapshots = useTimelineStore((state) => state.snapshots)
  const cursor = useTimelineStore((state) => state.cursor)
  const scrubTo = useTimelineStore((state) => state.scrubTo)
  const resumeLive = useTimelineStore((state) => state.resumeLive)
  const current = cursor === null ? snapshots.length - 1 : cursor

  if (snapshots.length === 0) {
    return (
      <p className="p-3 text-xs text-slate-600">
        CMI state changes will appear here as the course runs.
      </p>
    )
  }

  const selected = snapshots[current]
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Timeline">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {cursor === null ? 'Live' : `Snapshot ${current + 1} of ${snapshots.length}`}
        </span>
        <Button variant="ghost" size="sm" onClick={resumeLive} disabled={cursor === null}>
          Resume live
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        <input
          aria-label="Timeline position"
          type="range"
          min="0"
          max={snapshots.length - 1}
          value={current}
          onChange={(event) => scrubTo(Number(event.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between font-mono text-[11px] text-slate-500">
          <span>{timestamp(snapshots[0]?.timestamp ?? 0)}</span>
          <span>{timestamp(selected?.timestamp ?? 0)}</span>
          <span>{timestamp(snapshots.at(-1)?.timestamp ?? 0)}</span>
        </div>

        <ul className="space-y-1" aria-label="Snapshot points">
          {snapshots.map((snapshot, index) => {
            const isSelected = index === current
            return (
              <li key={`${snapshot.timestamp}-${index}`}>
                <button
                  type="button"
                  onClick={() => scrubTo(index)}
                  aria-pressed={isSelected}
                  data-selected={isSelected || undefined}
                  className={cn(
                    'flex w-full items-baseline gap-2 rounded-sm px-2 py-1 text-left font-mono text-[11px] transition-colors',
                    isSelected
                      ? 'bg-amber-400/10 text-amber-200'
                      : 'text-slate-400 hover:bg-surface-700 hover:text-slate-200',
                  )}
                >
                  <span className="shrink-0 tabular-nums text-slate-500">#{index + 1}</span>
                  <span className="shrink-0 tabular-nums">{timestamp(snapshot.timestamp)}</span>
                  <span className="truncate text-slate-500">{changedSummary(snapshot.changedPaths)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
