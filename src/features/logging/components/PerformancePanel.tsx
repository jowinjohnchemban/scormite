import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useLogStore } from '@/features/logging/state/logStore'
import { computePerformanceMetrics, safeMs } from '@/features/logging/services/performanceMetrics'
import { Button } from '@/components/ui/button'

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-20 flex-col gap-0.5 rounded-sm border border-border-subtle px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-600">{label}</span>
      <span className="font-mono text-sm text-slate-200">{value}</span>
    </div>
  )
}

/** Bottom-dock timing summary, aggregated from the real API call log. */
export function PerformancePanel() {
  const records = useLogStore((state) => state.records)
  const clearRecords = useLogStore((state) => state.clearRecords)
  const metrics = useMemo(() => computePerformanceMetrics(records), [records])

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Performance">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {metrics.total} {metrics.total === 1 ? 'call' : 'calls'} · avg {safeMs(metrics.avgMs)} ms
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear performance data"
          title="Clear performance data"
          onClick={clearRecords}
          disabled={metrics.total === 0}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </header>

      {metrics.total === 0 ? (
        <p className="p-3 text-xs text-slate-600">API calls will appear when the course starts.</p>
      ) : (
        <div className="min-h-0 overflow-auto p-2">
          <div className="mb-2 flex flex-wrap gap-2">
            <StatCard label="Total" value={String(metrics.total)} />
            <StatCard label="Errors" value={String(metrics.errorCount)} />
            <StatCard label="Avg" value={`${safeMs(metrics.avgMs)} ms`} />
            <StatCard label="P95" value={`${safeMs(metrics.p95Ms)} ms`} />
            <StatCard label="Max" value={`${safeMs(metrics.maxMs)} ms`} />
          </div>

          <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            Slowest calls
          </h3>
          <table className="mb-3 w-full border-collapse text-left font-mono text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">Method</th>
                <th className="px-2 py-1 font-medium">Element</th>
                <th className="px-2 py-1 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slowest.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-border-subtle/60 text-slate-300"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-500">
                    {formatTime(record.timestamp)}
                  </td>
                  <td className="px-2 py-1 text-accent">{record.method}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={record.element}>
                    {record.element ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-400">
                    {safeMs(record.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            By method
          </h3>
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Method</th>
                <th className="px-2 py-1 text-right font-medium">Calls</th>
                <th className="px-2 py-1 text-right font-medium">Errors</th>
                <th className="px-2 py-1 text-right font-medium">Avg ms</th>
                <th className="px-2 py-1 text-right font-medium">Max ms</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byMethod.map((stats) => (
                <tr
                  key={stats.method}
                  className="border-t border-border-subtle/60 text-slate-300"
                >
                  <td className="px-2 py-1 text-accent">{stats.method}</td>
                  <td className="px-2 py-1 text-right text-slate-400">{stats.count}</td>
                  <td
                    className={`px-2 py-1 text-right ${stats.errorCount > 0 ? 'text-red-400' : 'text-slate-500'}`}
                  >
                    {stats.errorCount}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-400">{safeMs(stats.avgMs)}</td>
                  <td className="px-2 py-1 text-right text-slate-400">{safeMs(stats.maxMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
