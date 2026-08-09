import { Button } from '@/components/ui/button'
import { useTimelineStore } from '@/features/timeline/state/timelineStore'

function timestamp(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  })
}

/** Scrubs recorded CMI snapshots; it never changes the running SCO. */
export function TimelinePanel() {
  const snapshots = useTimelineStore((state) => state.snapshots)
  const cursor = useTimelineStore((state) => state.cursor)
  const scrubTo = useTimelineStore((state) => state.scrubTo)
  const resumeLive = useTimelineStore((state) => state.resumeLive)
  const current = cursor === null ? snapshots.length - 1 : cursor

  if (snapshots.length === 0) {
    return <p className="p-3 text-xs text-slate-600">Runtime events will appear here as the course runs.</p>
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
      <div className="space-y-3 p-3">
        <input
          aria-label="Timeline position"
          type="range"
          min="0"
          max={snapshots.length - 1}
          value={current}
          onChange={(event) => scrubTo(Number(event.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between font-mono text-[11px] text-slate-500">
          <span>{timestamp(snapshots[0]?.timestamp ?? 0)}</span>
          <span>{timestamp(selected?.timestamp ?? 0)}</span>
          <span>{timestamp(snapshots.at(-1)?.timestamp ?? 0)}</span>
        </div>
        <p className="text-xs text-slate-400">
          {selected?.changedPaths.length ?? 0} CMI fields changed at this point.
        </p>
      </div>
    </section>
  )
}
