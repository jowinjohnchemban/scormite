/**
 * Builds the QA report from the live session and downloads it in any of the
 * report formats. Shared by the Reports panel (Advanced) and the header's
 * Report menu (both modes).
 *
 * Lives in `app/` because the report joins package, manifest, logging,
 * timeline, validation, and runtime state.
 */

import { useCallback } from 'react'
import { ReportBuilderService, type ReportData, type ReportFormat } from '@/features/reports'
import { usePackageStore } from '@/features/package-loader'
import { useManifestStore } from '@/features/manifest'
import { useLogStore } from '@/features/logging'
import { useTimelineStore } from '@/features/timeline'
import { useValidationStore } from '@/features/validation'
import { useRuntimeStore } from '@/features/runtime'
import { useCourseStore } from '@/app/state/courseStore'

export const REPORT_FORMATS: readonly { format: ReportFormat; label: string }[] = [
  { format: 'html', label: 'HTML report' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'json', label: 'JSON' },
  { format: 'csv', label: 'CSV (API log)' },
]

const MIME_TYPES: Record<ReportFormat, string> = {
  json: 'application/json;charset=UTF-8',
  csv: 'text/csv;charset=UTF-8',
  markdown: 'text/markdown;charset=UTF-8',
  html: 'text/html;charset=UTF-8',
}

const EXTENSIONS: Record<ReportFormat, string> = {
  json: 'json',
  csv: 'csv',
  markdown: 'md',
  html: 'html',
}

const SERIALIZERS: Record<ReportFormat, (data: ReportData) => string> = {
  json: (data) => ReportBuilderService.serializeJson(data),
  csv: (data) => ReportBuilderService.serializeCsv(data),
  markdown: (data) => ReportBuilderService.serializeMarkdown(data),
  html: (data) => ReportBuilderService.serializeHtml(data),
}

function reportFilename(pkgName: string | null, format: ReportFormat): string {
  const safeName = (pkgName ?? 'package').replace(/[^a-zA-Z0-9-_]/g, '_')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `scormite-report-${safeName}-${stamp}.${EXTENSIONS[format]}`
}

function download(content: string, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** The report as of now, from the stores' current state. */
function buildCurrentReport(): ReportData | null {
  const pkg = usePackageStore.getState().package
  const manifest = useManifestStore.getState().manifest
  if (!pkg || !manifest) return null
  const runtime = useRuntimeStore.getState()
  const course = useCourseStore.getState()
  return ReportBuilderService.buildReportData({
    pkg,
    manifest,
    course: {
      sequenced: course.sequenced,
      currentItemTitle: course.items.find((item) => item.identifier === course.currentItemId)?.title ?? null,
      items: course.items.map((item) => {
        const summary = course.progress[item.identifier]
        return {
          identifier: item.identifier,
          title: item.title,
          scormType: item.scormType,
          completionStatus: summary?.completionStatus ?? 'not attempted',
          successStatus: summary?.successStatus ?? 'unknown',
          score: summary?.score ?? '',
        }
      }),
    },
    sessionId: runtime.sessionId,
    scormVersion: runtime.scormVersion,
    isInitialized: runtime.isInitialized,
    isTerminated: runtime.isTerminated,
    apiCalls: useLogStore.getState().records,
    snapshots: useTimelineStore.getState().snapshots,
    validationIssues: useValidationStore.getState().issues,
  })
}

export interface ReportExport {
  /** False until a package is open. */
  ready: boolean
  exportReport: (format: ReportFormat) => void
}

/**
 * The report is built when it is exported — not on every API call — so the
 * export reflects that moment and costs nothing while the course runs.
 */
export function useReportExport(): ReportExport {
  const ready = usePackageStore((s) => s.package !== null)
  const exportReport = useCallback((format: ReportFormat) => {
    const report = buildCurrentReport()
    if (!report) return
    download(SERIALIZERS[format](report), reportFilename(report.package.name, format), MIME_TYPES[format])
  }, [])
  return { ready, exportReport }
}
