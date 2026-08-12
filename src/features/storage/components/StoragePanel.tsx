import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useStorageStore } from '@/features/storage/state/storageStore'
import { formatBytes } from '@/features/storage/services/StorageService'
import { Button } from '@/components/ui/button'

const REFRESH_INTERVAL_MS = 3000

/**
 * Bottom-dock view of the browser storage Scormite actually uses: Cache
 * Storage (package files served by the service worker) and localStorage
 * (dock layout, settings). IndexedDB is never used, so there is nothing to
 * show for it — the cache buckets are where package data really lives.
 */
export function StoragePanel() {
  const report = useStorageStore((state) => state.report)
  const refreshing = useStorageStore((state) => state.refreshing)
  const refresh = useStorageStore((state) => state.refresh)

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const entries = report?.entries ?? []
  const totalBytes = entries.reduce((sum, entry) => sum + (entry.sizeBytes ?? 0), 0)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Storage">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {entries.length} {entries.length === 1 ? 'store' : 'stores'} · {formatBytes(totalBytes)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh storage"
          title="Refresh storage"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw aria-hidden className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {report === null ? (
        <p className="p-3 text-xs text-slate-600">Inspecting browser storage…</p>
      ) : entries.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">No browser storage in use yet.</p>
      ) : (
        <div tabIndex={0} className="min-h-0 overflow-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-surface-900 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Kind</th>
                <th className="px-2 py-1 font-medium">Key</th>
                <th className="px-2 py-1 text-right font-medium">Items</th>
                <th className="px-2 py-1 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-border-subtle/60 text-slate-300 hover:bg-surface-900"
                >
                  <td className="px-2 py-1">
                    <span
                      className={
                        entry.origin === 'cache'
                          ? 'rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent'
                          : 'rounded-sm bg-slate-500/15 px-1.5 py-0.5 text-[10px] text-slate-400'
                      }
                    >
                      {entry.kind}
                    </span>
                  </td>
                  <td className="max-w-64 truncate px-2 py-1" title={entry.key}>
                    {entry.key}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-500">
                    {entry.itemCount ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-400">
                    {formatBytes(entry.sizeBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.usageBytes !== null && report.quotaBytes !== null && (
            <p className="border-t border-border-subtle px-2 py-1 text-[10px] text-slate-600">
              Browser estimate: {formatBytes(report.usageBytes)} of{' '}
              {formatBytes(report.quotaBytes)} used
            </p>
          )}
        </div>
      )}
    </section>
  )
}
