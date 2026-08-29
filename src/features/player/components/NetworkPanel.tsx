import { Trash2 } from 'lucide-react'
import { useNetworkStore } from '@/features/player/state/networkStore'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/shared/lib/format'

/**
 * Live trace of package-file requests served by the service worker. Every
 * row comes from a real FETCH_EVENT the worker posted back to the page — no
 * polling, no mock data.
 */
export function NetworkPanel() {
  const entries = useNetworkStore((state) => state.entries)
  const clearEntries = useNetworkStore((state) => state.clearEntries)
  const hits = entries.filter((entry) => entry.hit).length
  const misses = entries.length - hits

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Network">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {entries.length} {entries.length === 1 ? 'request' : 'requests'} · {hits} hits ·{' '}
          {misses} misses
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear network log"
          title="Clear network log"
          onClick={clearEntries}
          disabled={entries.length === 0}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </header>

      {entries.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">
          Package file requests will appear when the course loads.
        </p>
      ) : (
        <div tabIndex={0} className="min-h-0 overflow-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-surface-900 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">File</th>
                <th className="px-2 py-1 font-medium">Result</th>
                <th className="px-2 py-1 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-border-subtle/60 text-slate-300 hover:bg-surface-900"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-500">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="max-w-72 truncate px-2 py-1" title={entry.path}>
                    {entry.path}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={
                        entry.hit
                          ? 'rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400'
                          : 'rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400'
                      }
                    >
                      {entry.hit ? 'cache hit' : `miss · ${entry.status}`}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right text-slate-500">
                    {entry.durationMs.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
