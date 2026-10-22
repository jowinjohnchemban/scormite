/**
 * Basic Mode shell — fixed two-column layout, rendered over the persistent
 * player layer owned by `App`.
 * Left: package summary, course outline, live status, API log.
 * Right: transparent space over the player.
 *
 * The iframe itself lives in `App` so a running SCO survives mode switches;
 * this shell only provides chrome.
 */

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { DropZone } from '@/features/package-loader'
import { useCmiState } from '@/app/hooks/useCmiState'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { cn } from '@/shared/lib/utils'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { CourseOutline } from '@/app/course/CourseOutline'
import { LandingContent } from '@/app/landing/LandingContent'
import { useCourseStore } from '@/app/state/courseStore'
import { useLogStore } from '@/features/logging'
import { useManifestStore } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { useValidationStore } from '@/features/validation'
import { formatTime } from '@/shared/lib/format'
import { Button } from '@/components/ui/button'
import type { ApiCallRecord } from '@/shared/types'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// Package header
// ---------------------------------------------------------------------------

function PackageHeader() {
  const pkg = usePackageStore((s) => s.package)
  const manifest = useManifestStore((s) => s.manifest)
  const itemCount = useCourseStore((s) => s.items.length)
  const errorCount = useValidationStore((s) => s.issues.filter((i) => i.severity === 'error').length)

  if (!pkg || !manifest) return null

  const scoCount = manifest.resources.filter((r) => r.scormType === 'sco').length
  const edition = pkg.scormEdition ? ` ${pkg.scormEdition} Edition` : ''
  const title = manifest.metadata.title ?? manifest.organizations[0]?.title

  return (
    <div className="shrink-0 border-b border-border-subtle px-3 py-2">
      <p className="truncate text-sm font-medium text-slate-200" title={pkg.name}>
        {pkg.name}
      </p>
      {title && title !== pkg.name && (
        <p className="truncate text-xs text-slate-400" title={title}>
          {title}
        </p>
      )}
      <p className="mt-0.5 truncate text-xs text-slate-500" title={`SCORM ${pkg.scormVersion}${edition}`}>
        SCORM {pkg.scormVersion}
        {edition}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        {plural(itemCount, 'item')} · {plural(scoCount, 'SCO')} ·{' '}
        {plural(manifest.resources.length - scoCount, 'asset')}
      </p>
      {errorCount > 0 && (
        <p className="mt-1 text-[11px] text-red-400">
          {plural(errorCount, 'package error')} — see the report or Advanced › Validation
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live status of the running item
// ---------------------------------------------------------------------------

function CmiSummaryPanel() {
  const cmi = useCmiState()
  const rows: [string, string][] = [
    ['Status', cmi.completionStatus],
    ['Success', cmi.successStatus],
    ['Score', cmi.score || '—'],
    ['Location', cmi.location || '—'],
    ['Time', cmi.time || '—'],
  ]
  return (
    <div className="shrink-0 border-b border-border-subtle px-3 py-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 py-0.5 text-xs">
          <span className="shrink-0 text-slate-500">{label}</span>
          <span className="truncate text-slate-300" title={value}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// API log (compact) — the call trace shown in Basic
// ---------------------------------------------------------------------------

const LOG_PREVIEW = 30

function describeCall(record: ApiCallRecord): string {
  const call = `${record.method}${record.element ? ` ${record.element}` : ''}${record.value !== undefined ? ` = ${record.value}` : ''}`
  const result = record.errorCode
    ? `Error ${record.errorCode}${record.errorString ? ` — ${record.errorString}` : ''}${record.diagnostic ? `\n${record.diagnostic}` : ''}`
    : `→ ${record.returnValue}`
  return `${call}\n${result}`
}

function BasicApiLog() {
  const records = useLogStore((s) => s.records)
  const clearRecords = useLogStore((s) => s.clearRecords)
  const errorCount = records.filter((r) => r.errorCode).length
  const preview = records.slice(-LOG_PREVIEW).toReversed()

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="API log">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-900 px-2">
        <span className="text-[11px] text-slate-500">
          {records.length === 0 ? 'API log' : plural(records.length, 'call')}
          {errorCount > 0 && <span className="text-red-400"> · {plural(errorCount, 'error')}</span>}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Clear API log"
          title="Clear API log"
          onClick={clearRecords}
          disabled={records.length === 0}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </Button>
      </header>

      {records.length === 0 ? (
        <p className="p-3 text-xs text-slate-600">SCORM API calls will appear here once the course initializes.</p>
      ) : (
        <div
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[4.5rem]" />
              <col />
              <col className="w-[4.5rem]" />
            </colgroup>
            <thead className="sticky top-0 bg-surface-900 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">Call</th>
                <th className="px-2 py-1 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((record) => (
                <tr
                  key={record.id}
                  title={describeCall(record)}
                  className="border-t border-border-subtle/60 hover:bg-surface-800/80"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatTime(record.timestamp, false)}</td>
                  <td className="truncate px-2 py-1 text-slate-300">
                    <span className="text-accent">{record.method}</span>
                    {record.element ? <span className="text-slate-500"> {record.element}</span> : null}
                  </td>
                  <td className={record.errorCode ? 'truncate px-2 py-1 text-red-400' : 'truncate px-2 py-1 text-emerald-400'}>
                    {record.errorCode ? `Err ${record.errorCode}` : record.returnValue || '""'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > LOG_PREVIEW && (
            <p className="px-2 py-1 text-[10px] text-slate-600">
              Showing latest {LOG_PREVIEW} of {records.length} — the full log is in the report and Advanced › API Log
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Narrow screens: the same content in tabs, so each part gets the full height
// ---------------------------------------------------------------------------

type SidebarTab = 'course' | 'status' | 'log'

function CompactSidebar() {
  const [tab, setTab] = useState<SidebarTab>('course')
  const callCount = useLogStore((s) => s.records.length)
  const tabs: { id: SidebarTab; label: string }[] = [
    { id: 'course', label: 'Course' },
    { id: 'status', label: 'Status' },
    { id: 'log', label: callCount > 0 ? `Log (${callCount})` : 'Log' },
  ]
  return (
    <>
      <div role="tablist" aria-label="Session details" className="flex h-9 shrink-0 border-b border-border-subtle">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`sidebar-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls="sidebar-panel"
            onClick={() => setTab(entry.id)}
            className={cn(
              'flex-1 border-b-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
              tab === entry.id ? 'border-accent text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div id="sidebar-panel" role="tabpanel" aria-labelledby={`sidebar-tab-${tab}`} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'course' && (
          <>
            <PackageHeader />
            <CourseOutline className="min-h-0 flex-1" />
          </>
        )}
        {tab === 'status' && (
          <div className="min-h-0 overflow-y-auto">
            <CmiSummaryPanel />
          </div>
        )}
        {tab === 'log' && <BasicApiLog />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function BasicModeShell({ session }: { session: PackageSession }) {
  const { pkg, loading, error } = session
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden lg:flex-row">
      {pkg === null ? (
        /* Opaque backdrop so the upload state covers the player layer. */
        <div className="pointer-events-auto h-full w-full bg-surface-950">
          <LandingContent
            dropZone={<DropZone onFile={session.loadFile} loading={loading} error={error} />}
          />
        </div>
      ) : (
        <>
          {/* Left: a 256px sidebar on desktop; above the player, tabbed, on narrow screens */}
          <aside
            aria-label="Session"
            className="pointer-events-auto flex h-[40vh] w-full shrink-0 flex-col overflow-hidden border-b border-border-subtle bg-surface-900 lg:h-full lg:w-64 lg:border-b-0 lg:border-r"
          >
            {isDesktop ? (
              <>
                <PackageHeader />
                <CourseOutline className="max-h-[35%] shrink-0 border-b border-border-subtle" />
                <CmiSummaryPanel />
                <BasicApiLog />
              </>
            ) : (
              <CompactSidebar />
            )}
          </aside>

          {/* Right: transparent space over the persistent player */}
          <div className="pointer-events-none min-h-0 min-w-0 flex-1" />
        </>
      )}
    </div>
  )
}
