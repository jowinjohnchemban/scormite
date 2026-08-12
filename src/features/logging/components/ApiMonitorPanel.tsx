import { Trash2 } from 'lucide-react'
import { useLogStore } from '@/features/logging/state/logStore'
import { Button } from '@/components/ui/button'

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(timestamp)
}

/** A live, chronological trace of every call made through the SCORM API. */
export function ApiMonitorPanel() {
  const records = useLogStore((state) => state.records)
  const clearRecords = useLogStore((state) => state.clearRecords)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="API Monitor">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {records.length} {records.length === 1 ? 'call' : 'calls'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear API calls"
          title="Clear API calls"
          onClick={clearRecords}
          disabled={records.length === 0}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </header>

      {records.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">API calls will appear when the course starts.</p>
      ) : (
        <div tabIndex={0} className="min-h-0 overflow-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-surface-900 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">Method</th>
                <th className="px-2 py-1 font-medium">Element</th>
                <th className="px-2 py-1 font-medium">Value</th>
                <th className="px-2 py-1 font-medium">Result</th>
                <th className="px-2 py-1 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  data-testid={`api-call-${record.id}`}
                  className="border-t border-border-subtle/60 text-slate-300 hover:bg-surface-900"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-500">{formatTime(record.timestamp)}</td>
                  <td className="px-2 py-1 text-accent">{record.method}</td>
                  <td className="px-2 py-1">{record.element ?? '—'}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={record.value}>
                    {record.value ?? '—'}
                  </td>
                  <td className={record.errorCode ? 'px-2 py-1 text-red-400' : 'px-2 py-1 text-emerald-400'}>
                    {record.errorCode ? `Error ${record.errorCode}` : record.returnValue}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-500">{record.durationMs.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
