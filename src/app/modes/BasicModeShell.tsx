/**
 * Basic Mode shell — fixed two-column layout, rendered over the persistent
 * player layer owned by `App`.
 * Left: package summary + manifest tree.  Right: transparent space over the
 * player.
 *
 * The iframe itself lives in `App` so a running SCO survives mode switches;
 * this shell only provides chrome.
 */

import { Trash2 } from 'lucide-react'
import { DropZone } from '@/features/package-loader'
import { useCmiState } from '@/app/hooks/useCmiState'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import { useLogStore } from '@/features/logging'
import { useManifestStore } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { useRuntimeStore } from '@/features/runtime'
import { formatTime } from '@/shared/lib/format'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// CMI summary panel
// ---------------------------------------------------------------------------

function CmiSummaryPanel() {
  const cmi = useCmiState()
  const rows: [string, string][] = [
    ['Status', cmi.completionStatus],
    ['Success', cmi.successStatus],
    ['Score', cmi.scoreRaw || cmi.scoreScaled || '—'],
    ['Location', cmi.location || '—'],
    ['Time', cmi.totalTime || '—'],
  ]
  return (
    <div className="border-b border-border-subtle px-3 py-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-0.5 text-xs">
          <span className="text-slate-500">{label}</span>
          <span className="text-slate-300">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Package header — richer top detail (when a package is loaded)
// ---------------------------------------------------------------------------

function PackageHeader() {
  const pkg = usePackageStore((s) => s.package)
  const manifest = useManifestStore((s) => s.manifest)
  const runtimeVersion = useRuntimeStore((s) => s.scormVersion)

  if (!pkg || !manifest) return null

  const scoCount = manifest.resources.filter((r) => r.scormType === 'sco').length
  const activeOrg = manifest.organizations.find(
    (org) => org.identifier === manifest.defaultOrganizationIdentifier,
  )
  const edition = pkg.scormEdition ? ` ${pkg.scormEdition} Edition` : ''
  const activeRuntime = runtimeVersion ? `Runtime: SCORM ${runtimeVersion}` : null
  const schema = manifest.metadata.schema ?? 'ADL SCORM'
  const schemaVersion = manifest.metadata.schemaVersion ?? ''

  return (
    <div className="shrink-0 border-b border-border-subtle px-3 py-2">
      <p className="truncate text-sm font-medium text-slate-200" title={pkg.name}>
        {pkg.name}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500" title={`${pkg.scormVersion}${edition}`}>
        SCORM {pkg.scormVersion}
        {edition}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
        <span title={schema}>{schema}</span>
        {schemaVersion && <span title={schemaVersion}>{schemaVersion}</span>}
        {activeRuntime && <span>{activeRuntime}</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        <span>
          {manifest.organizations.length} org · {pkg.scormVersion === '2004' ? 'organizations' : 'organizations'}
        </span>
        {activeOrg && <span title={activeOrg.title}>{activeOrg.title}</span>}
        <span>{scoCount} SCO · {manifest.resources.length - scoCount} asset</span>
        {pkg.launchUrl && (
          <span className="truncate" title={pkg.launchUrl}>
            {pkg.launchUrl}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// API log (compact, left-docked) — the only call trace shown in Basic
// ---------------------------------------------------------------------------

function BasicApiLog() {
  const records = useLogStore((s) => s.records)
  const clearRecords = useLogStore((s) => s.clearRecords)
  const preview = records.slice(-15).toReversed()

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="API log">
      <header className="flex h-8 shrink-0 items-center justify-between border-t border-b border-border-subtle bg-surface-900 px-2">
        <span className="text-[11px] text-slate-500">
          {records.length === 0 ? 'API log' : `${records.length} calls`}
        </span>
        <Button
          variant="ghost"
          size="icon"
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
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-surface-900 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Time</th>
                <th className="px-2 py-1 font-medium">Call</th>
                <th className="px-2 py-1 font-medium">Result</th>
                <th className="px-2 py-1 text-right font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((record) => (
                <tr
                  key={record.id}
                  title={`${record.method}${record.element ? ` ${record.element}` : ''}${record.value !== undefined ? ` = ${record.value}` : ''}`}
                  className="border-t border-border-subtle/60 hover:bg-surface-800/80"
                >
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">{formatTime(record.timestamp)}</td>
                  <td className="max-w-24 truncate px-2 py-1 text-slate-300" title={record.element ?? record.method}>
                    <span className="text-accent">{record.method}</span>
                    {record.element ? <span className="text-slate-500"> {record.element}</span> : null}
                  </td>
                  <td
                    className={record.errorCode ? 'px-2 py-1 text-red-400' : 'px-2 py-1 text-emerald-400'}
                    title={record.errorCode ? `Error ${record.errorCode}` : record.returnValue}
                  >
                    {record.errorCode ? `Error ${record.errorCode}` : record.returnValue}
                  </td>
                  <td className="px-2 py-1 text-right text-slate-500">{record.durationMs.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > 15 && (
            <p className="px-2 py-1 text-[10px] text-slate-600">Showing latest 15 of {records.length}</p>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function BasicModeShell({ session }: { session: PackageSession }) {
  const { pkg, loading, error } = session
  const showDropZone = pkg === null || loading || error !== null

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden lg:flex-row">
      {showDropZone ? (
        /* Opaque backdrop so the upload state covers the player layer. */
        <div className="pointer-events-auto h-full w-full bg-surface-950">
          <DropZone onFile={session.loadFile} loading={loading} error={error} />
        </div>
      ) : (
        <>
          {/* Left: richer package header + CMI summary + API log — full-width on mobile, 256px sidebar on desktop */}
          <aside className="pointer-events-auto flex max-h-[48vh] w-full flex-col overflow-hidden border-b border-border-subtle bg-surface-900 lg:max-h-none lg:h-full lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
            <PackageHeader />
            <CmiSummaryPanel />
            <BasicApiLog />
          </aside>

          {/* Right: transparent space over the persistent player */}
          <main className="pointer-events-none min-h-0 min-w-0 flex-1" />
        </>
      )}
    </div>
  )
}
