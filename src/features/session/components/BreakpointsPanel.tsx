import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  BreakpointService,
  describeBreakpoint,
  validateBreakpointDraft,
  type BreakpointDraft,
} from '@/features/session/services/BreakpointService'
import { useBreakpointStore } from '@/features/session/state/breakpointStore'
import { cn } from '@/shared/lib/utils'
import type { BreakpointKind, ScormApiMethod } from '@/shared/types'

const KINDS: Array<{ value: BreakpointKind; label: string }> = [
  { value: 'cmi-set', label: 'SetValue on an element' },
  { value: 'score-threshold', label: 'Score at or above' },
  { value: 'objective-update', label: 'Objective change' },
  { value: 'api-call', label: 'Every SetValue or Commit' },
]

/**
 * Only calls whose effect can be deferred can be held: the SCORM API is
 * synchronous, so the SCO gets its answer immediately and the held call is
 * applied on Resume. Initialize, Terminate, and reads cannot be held without
 * lying to the course.
 */
const METHODS: ScormApiMethod[] = ['SetValue', 'Commit']

const inputClass =
  'h-7 min-w-0 rounded-sm border border-border-subtle bg-surface-800 px-2 text-xs ' +
  'text-slate-200 outline-none placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-accent'

/**
 * Breakpoint CRUD + pause control. The list shows what each breakpoint
 * matches; while a breakpoint is holding execution a banner offers Resume.
 */
export function BreakpointsPanel() {
  const breakpoints = useBreakpointStore((s) => s.breakpoints)
  const paused = useBreakpointStore((s) => s.paused)
  const currentHit = useBreakpointStore((s) => s.currentHit)

  const [kind, setKind] = useState<BreakpointKind>('cmi-set')
  const [method, setMethod] = useState<ScormApiMethod>('SetValue')
  const [element, setElement] = useState('')
  const [value, setValue] = useState('')
  const [threshold, setThreshold] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const draft: BreakpointDraft = {
      kind,
      ...(kind === 'api-call' ? { method } : {}),
      ...(element.trim() !== '' ? { element } : {}),
      ...(kind === 'cmi-set' && value.trim() !== '' ? { value } : {}),
      ...(kind === 'score-threshold' && threshold !== '' ? { threshold: Number(threshold) } : {}),
    }
    const message = validateBreakpointDraft(draft)
    if (message) {
      setError(message)
      return
    }
    BreakpointService.add(draft)
    setError(null)
    setElement('')
    setValue('')
    setThreshold('')
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Breakpoints">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <span className="text-[11px] text-slate-500">
          {breakpoints.length === 0
            ? 'No breakpoints'
            : `${breakpoints.length} breakpoint${breakpoints.length === 1 ? '' : 's'}`}
        </span>
        {breakpoints.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => BreakpointService.clear()}>
            Clear all
          </Button>
        )}
      </header>

      {paused && currentHit && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-400/10 px-2 py-1.5">
          <span className="truncate font-mono text-[11px] text-amber-200">
            Holding {currentHit.method}
            {currentHit.element ? ` ${currentHit.element}` : ''}
            {currentHit.value !== undefined ? ` = ${currentHit.value}` : ''}
          </span>
          <Button size="sm" onClick={() => BreakpointService.resume()}>
            Resume
          </Button>
        </div>
      )}

      <div
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {breakpoints.length === 0 ? (
          <p className="text-xs text-slate-600">
            A breakpoint holds a matching SetValue or Commit before it reaches the runtime, so you can inspect the data
            first. The course keeps running and receives "true"; held calls are applied in order when you resume.
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Breakpoint list">
            {breakpoints.map((breakpoint) => (
              <li
                key={breakpoint.id}
                className={cn(
                  'flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-1',
                  !breakpoint.enabled && 'opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={breakpoint.enabled}
                  onChange={() => BreakpointService.toggle(breakpoint.id)}
                  aria-label="Enable or disable breakpoint"
                  className="accent-accent"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                  {describeBreakpoint(breakpoint)}
                </span>
                {breakpoint.hitCount > 0 && (
                  <span className="shrink-0 rounded-sm bg-amber-400/15 px-1 font-mono text-[10px] tabular-nums text-amber-200">
                    ×{breakpoint.hitCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => BreakpointService.remove(breakpoint.id)}
                  aria-label="Remove breakpoint"
                  className="shrink-0 text-slate-600 transition-colors hover:text-slate-200"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="mt-3 space-y-2 border-t border-border-subtle pt-3">
          <div className="flex items-center gap-2">
            <select
              aria-label="Breakpoint kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as BreakpointKind)}
              className={cn(inputClass, 'flex-1')}
            >
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {kind === 'api-call' && (
              <select
                aria-label="Method to match"
                value={method}
                onChange={(e) => setMethod(e.target.value as ScormApiMethod)}
                className={cn(inputClass, 'flex-1')}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {(kind === 'cmi-set' || kind === 'score-threshold' || kind === 'objective-update') && (
            <input
              aria-label="Element path to match"
              type="text"
              value={element}
              onChange={(e) => setElement(e.target.value)}
              placeholder={
                kind === 'score-threshold' || kind === 'objective-update'
                  ? 'Element path (optional, e.g. cmi.core.score.raw)'
                  : 'Element path (e.g. cmi.core.score.raw)'
              }
              className={cn(inputClass, 'w-full')}
            />
          )}

          {kind === 'cmi-set' && (
            <input
              aria-label="Value to match"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value (optional, exact match)"
              className={cn(inputClass, 'w-full')}
            />
          )}

          {kind === 'score-threshold' && (
            <input
              aria-label="Score threshold"
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Threshold (e.g. 80)"
              className={cn(inputClass, 'w-full')}
            />
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <Button type="submit" variant="outline" size="sm" className="w-full">
            Add breakpoint
          </Button>
        </form>
      </div>
    </section>
  )
}
