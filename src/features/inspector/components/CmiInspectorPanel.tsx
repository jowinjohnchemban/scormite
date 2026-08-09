import { useInspectorStore } from '@/features/inspector/state/inspectorStore'

/** A live flattened CMI model with paths changed by the most recent API call. */
export function CmiInspectorPanel() {
  const values = useInspectorStore((state) => state.values)
  const changedPaths = useInspectorStore((state) => state.changedPaths)
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="CMI Inspector">
      <header className="flex h-8 shrink-0 items-center border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">{entries.length} CMI fields</span>
      </header>
      {entries.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">Launch a course to inspect its CMI data model.</p>
      ) : (
        <div className="min-h-0 overflow-auto font-mono text-[11px]">
          {entries.map(([path, value]) => {
            const depth = path.split('.').length - 1
            const changed = changedPaths.includes(path)
            return (
              <div
                key={path}
                data-testid={`cmi-field-${path}`}
                data-changed={changed || undefined}
                className={
                  changed
                    ? 'flex min-w-max border-b border-border-subtle/60 bg-amber-400/10 py-1 text-amber-100'
                    : 'flex min-w-max border-b border-border-subtle/60 py-1 text-slate-300'
                }
              >
                <span
                  className="w-1/2 min-w-52 truncate pr-2 text-slate-400"
                  style={{ paddingLeft: `${8 + depth * 12}px` }}
                >
                  {path}
                </span>
                <span className="min-w-40 break-all pr-2">{value || '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
