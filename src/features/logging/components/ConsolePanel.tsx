import { Trash2 } from 'lucide-react'
import { useLogStore } from '@/features/logging/state/logStore'
import { Button } from '@/components/ui/button'

function callText(record: ReturnType<typeof useLogStore.getState>['records'][number]): string {
  const args = [record.element, record.value]
    .filter((value): value is string => value !== undefined)
    .map((value) => JSON.stringify(value))
    .join(', ')
  const outcome = record.errorCode ? `error ${record.errorCode}` : JSON.stringify(record.returnValue)
  return `${record.method}(${args}) → ${outcome}`
}

/** A compact console view of the runtime call stream, useful for copying traces. */
export function ConsolePanel() {
  const records = useLogStore((state) => state.records)
  const clearRecords = useLogStore((state) => state.clearRecords)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Console">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">Runtime output</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear console"
          title="Clear console"
          onClick={clearRecords}
          disabled={records.length === 0}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </header>
      {records.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">No runtime output yet.</p>
      ) : (
        <ol className="min-h-0 overflow-auto p-2 font-mono text-[11px] leading-5">
          {records.map((record) => (
            <li key={record.id} className={record.errorCode ? 'text-red-400' : 'text-slate-300'}>
              <span className="mr-2 text-slate-600">{new Date(record.timestamp).toLocaleTimeString()}</span>
              {callText(record)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
