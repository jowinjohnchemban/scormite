import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useLogStore } from '@/features/logging/state/logStore'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import type { ApiCallRecord } from '@/shared/types'

/** "SetValue 12 · GetValue 30 · …" — what the course has been calling, and how often. */
function methodSummary(records: ApiCallRecord[]): { method: string; count: number; errors: number }[] {
  const byMethod = new Map<string, { count: number; errors: number }>()
  for (const record of records) {
    const entry = byMethod.get(record.method) ?? { count: 0, errors: 0 }
    entry.count += 1
    if (record.errorCode) entry.errors += 1
    byMethod.set(record.method, entry)
  }
  return [...byMethod.entries()].map(([method, stats]) => ({ method, ...stats }))
}

function errorText(record: ApiCallRecord): string {
  if (!record.errorCode) return ''
  return [`Error ${record.errorCode}`, record.errorString, record.diagnostic].filter(Boolean).join(' — ')
}

/** A live, chronological trace of every call made through the SCORM API. */
export function ApiMonitorPanel() {
  const records = useLogStore((state) => state.records)
  const clearRecords = useLogStore((state) => state.clearRecords)
  const [errorsOnly, setErrorsOnly] = useState(false)

  const summary = useMemo(() => methodSummary(records), [records])
  const errorCount = summary.reduce((total, entry) => total + entry.errors, 0)
  const visible = errorsOnly ? records.filter((record) => record.errorCode) : records

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="API Log">
      <header className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-subtle px-2 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>
            {records.length} {records.length === 1 ? 'call' : 'calls'}
            {errorCount > 0 && <span className="text-red-400"> · {errorCount} failed</span>}
          </span>
          {summary.length > 0 && (
            <span className="truncate font-mono" title="Calls per method">
              {summary.map((entry) => `${entry.method} ${entry.count}`).join(' · ')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(event) => setErrorsOnly(event.target.checked)}
              className="accent-accent"
            />
            Failed only
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Clear API calls"
            title="Clear API calls"
            onClick={clearRecords}
            disabled={records.length === 0}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">
          {records.length === 0 ? 'API calls will appear when the course starts.' : 'No failed calls.'}
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
                <th className="px-2 py-1 font-medium">Method</th>
                <th className="px-2 py-1 font-medium">Element</th>
                <th className="px-2 py-1 font-medium">Value</th>
                <th className="px-2 py-1 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr
                  key={record.id}
                  data-testid={`api-call-${record.id}`}
                  className="border-t border-border-subtle/60 align-top text-slate-300 hover:bg-surface-900"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-500">{formatTime(record.timestamp)}</td>
                  <td className="px-2 py-1 text-accent">{record.method}</td>
                  <td className="px-2 py-1">{record.element ?? '—'}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={record.value ?? undefined}>
                    {record.value ?? '—'}
                  </td>
                  <td className={cn('px-2 py-1', record.errorCode ? 'text-red-400' : 'text-emerald-400')}>
                    {record.errorCode ? (
                      <span title={errorText(record)}>
                        {record.errorCode}
                        {record.errorString && <span className="text-red-300/80"> {record.errorString}</span>}
                      </span>
                    ) : (
                      record.returnValue || '""'
                    )}
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
