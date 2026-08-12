import { Button } from '@/components/ui/button'
import type { ReportData, ReportFormat } from '../services/ReportBuilderService'

interface ReportsPanelProps {
  reportData: ReportData | null
  ready: boolean
  onExport: (format: ReportFormat) => void
}

const exportOptions: Array<{ label: string; format: ReportFormat }> = [
  { label: 'JSON', format: 'json' },
  { label: 'CSV', format: 'csv' },
  { label: 'Markdown', format: 'markdown' },
  { label: 'HTML', format: 'html' },
]

export function ReportsPanel({ reportData, ready, onExport }: ReportsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Reports">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle px-2">
        <div>
          <p className="text-xs text-slate-500">Generate a one-click QA report for the current package.</p>
        </div>
        <div className="flex items-center gap-1">
          {exportOptions.map((option) => (
            <Button
              key={option.format}
              data-testid={`export-${option.format}`}
              variant="ghost"
              size="sm"
              onClick={() => onExport(option.format)}
              disabled={!ready}
            >
              Export {option.label}
            </Button>
          ))}
        </div>
      </header>

      <div tabIndex={0} className="min-h-0 flex-1 overflow-auto p-3 space-y-4 text-sm text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
        {!ready || !reportData ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded border border-border-subtle bg-surface-950 p-6 text-center text-xs text-slate-500">
            <p>No package is loaded yet.</p>
            <p>Load a SCORM package and return here to export its manifest, runtime, timeline, and logs.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-border-subtle bg-surface-950 p-3">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Package</h2>
                <p className="text-sm text-slate-200">{reportData.package.name}</p>
                <p className="text-xs text-slate-500">
                  SCORM {reportData.package.scormVersion}
                  {reportData.package.scormEdition ? ` ${reportData.package.scormEdition}` : ''}
                </p>
                <p className="text-xs text-slate-500 truncate" title={reportData.package.launchUrl}>
                  {reportData.package.launchUrl}
                </p>
              </div>
              <div className="rounded border border-border-subtle bg-surface-950 p-3">
                <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Runtime</h2>
                <p className="text-sm text-slate-200">Profile: {reportData.runtime.activeProfileId}</p>
                <p className="text-xs text-slate-500">Session ID: {reportData.runtime.sessionId ?? 'N/A'}</p>
                <p className="text-xs text-slate-500">Initialized: {String(reportData.runtime.isInitialized)}</p>
                <p className="text-xs text-slate-500">Terminated: {String(reportData.runtime.isTerminated)}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded border border-border-subtle bg-surface-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">API Calls</p>
                <p className="text-2xl text-slate-200">{reportData.runtime.apiCallCount}</p>
              </div>
              <div className="rounded border border-border-subtle bg-surface-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Timeline Snapshots</p>
                <p className="text-2xl text-slate-200">{reportData.runtime.snapshotCount}</p>
              </div>
              <div className="rounded border border-border-subtle bg-surface-950 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Validation Issues</p>
                <p className="text-2xl text-slate-200">{reportData.runtime.validationIssueCount}</p>
              </div>
            </div>

            <div className="rounded border border-border-subtle bg-surface-950 p-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Recent activity</h2>
              {reportData.apiCalls.length === 0 ? (
                <p className="text-xs text-slate-500">No API calls recorded yet.</p>
              ) : (
                <ul className="space-y-1 text-[11px] text-slate-300">
                  {reportData.apiCalls.slice(-5).map((record) => (
                    <li key={record.id} className="flex items-center justify-between gap-3 rounded-sm bg-surface-900 px-2 py-1">
                      <span className="truncate">{record.method} {record.element ?? ''}</span>
                      <span className="text-slate-500">{record.durationMs.toFixed(1)} ms</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
