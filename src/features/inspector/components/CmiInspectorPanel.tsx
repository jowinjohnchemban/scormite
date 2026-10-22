import { useState } from 'react'
import { useInspectorStore } from '@/features/inspector/state/inspectorStore'
import { getFieldLabel } from '@/shared/config/fieldConfig'

/**
 * Defense in depth: values are normalized to strings at the adapter boundary,
 * but never render a non-string raw — React throws on object children.
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value || '—'
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * The live CMI data model of the running SCO. Paths changed by the most
 * recent call are highlighted; the filter narrows by path or value (courses
 * with many interactions produce hundreds of fields).
 */
export function CmiInspectorPanel() {
  const values = useInspectorStore((state) => state.values)
  const changedPaths = useInspectorStore((state) => state.changedPaths)
  const isReplay = useInspectorStore((state) => state.isReplay)
  const [filter, setFilter] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)

  const query = filter.trim().toLowerCase()
  const all = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
  const entries = all.filter(
    ([path, value]) =>
      (!changedOnly || changedPaths.includes(path)) &&
      (query === '' || path.toLowerCase().includes(query) || formatValue(value).toLowerCase().includes(query)),
  )

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="CMI Inspector">
      <header className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-subtle px-2 py-1">
        <span className="text-[11px] text-slate-500">
          {entries.length === all.length ? `${all.length} fields` : `${entries.length} of ${all.length} fields`}
        </span>
        {isReplay && (
          <span className="rounded-sm bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            Replay
          </span>
        )}
        <input
          type="search"
          aria-label="Filter CMI fields"
          placeholder="Filter path or value"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-6 min-w-28 flex-1 rounded-sm border border-border-subtle bg-surface-800 px-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-accent"
        />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={changedOnly}
            onChange={(event) => setChangedOnly(event.target.checked)}
            className="accent-accent"
          />
          Changed
        </label>
      </header>
      {all.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">Launch a course to inspect its CMI data model.</p>
      ) : entries.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">No fields match.</p>
      ) : (
        <div
          tabIndex={0}
          className="min-h-0 overflow-auto font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          {entries.map(([path, value]) => {
            const depth = path.split('.').length - 1
            const changed = changedPaths.includes(path)
            const label = getFieldLabel(path)
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
                  title={label !== path ? `${path} — ${label}` : path}
                >
                  {path}
                </span>
                <span className="min-w-40 break-all pr-2">{formatValue(value)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
