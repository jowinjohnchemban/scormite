import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useNetworkStore } from '@/features/player/state/networkStore'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/shared/lib/format'

/** `/scorm-files/{package}/lessons/My%20File.html` → `lessons/My File.html`. */
function packagePath(path: string): string {
  const relative = path.split('/').slice(3).join('/')
  try {
    return decodeURIComponent(relative)
  } catch {
    return relative
  }
}

/**
 * Every package file the course requested, as the service worker served
 * it. A request for a file the package does not contain is the usual cause
 * of a blank page, a missing image, or a broken script, so those are called
 * out and can be shown on their own.
 */
export function NetworkPanel() {
  const entries = useNetworkStore((state) => state.entries)
  const clearEntries = useNetworkStore((state) => state.clearEntries)
  const [missingOnly, setMissingOnly] = useState(false)
  const missing = entries.filter((entry) => !entry.hit).length
  const visible = missingOnly ? entries.filter((entry) => !entry.hit) : entries

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Network">
      <header className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-subtle px-2 py-1">
        <span className="text-[11px] text-slate-500">
          {entries.length} {entries.length === 1 ? 'request' : 'requests'}
          {missing > 0 && <span className="text-red-400"> · {missing} not in package</span>}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(event) => setMissingOnly(event.target.checked)}
              className="accent-accent"
            />
            Missing only
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Clear network log"
            title="Clear network log"
            onClick={clearEntries}
            disabled={entries.length === 0}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">
          {entries.length === 0
            ? 'Files the course requests will appear here as it loads.'
            : 'Every requested file was found in the package.'}
        </p>
      ) : (
        <div
          tabIndex={0}
          className="min-h-0 overflow-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-surface-900 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">File</th>
                <th className="px-2 py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const file = packagePath(entry.path)
                return (
                  <tr key={entry.id} className="border-t border-border-subtle/60 text-slate-300 hover:bg-surface-900">
                    <td className="whitespace-nowrap px-2 py-1 text-slate-500">{formatTime(entry.timestamp)}</td>
                    <td className="max-w-96 truncate px-2 py-1" title={file}>
                      {file}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {entry.hit ? (
                        <span className="text-emerald-400">{entry.status}</span>
                      ) : (
                        <span className="rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                          {entry.status} · not in package
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
