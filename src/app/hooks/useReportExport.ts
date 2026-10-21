/**
 * Builds the QA report from the live session and downloads it in any of the
 * report formats. Shared by the Reports panel (Advanced) and the header's
 * Report menu (both modes).
 *
 * Lives in `app/` because the report joins package, manifest, logging,
 * timeline, validation, and runtime state.
 */

import { useCallback, useMemo } from 'react'
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

export interface ReportExport {
  /** Null until a package is loaded. */
  reportData: ReportData | null
  exportReport: (format: ReportFormat) => void
}

export function useReportExport(): ReportExport {
  const pkg = usePackageStore((s) => s.package)
  const manifest = useManifestStore((s) => s.manifest)
  const records = useLogStore((s) => s.records)
  const snapshots = useTimelineStore((s) => s.snapshots)
  const validationIssues = useValidationStore((s) => s.issues)
  const sessionId = useRuntimeStore((s) => s.sessionId)
  const scormVersion = useRuntimeStore((s) => s.scormVersion)
  const isInitialized = useRuntimeStore((s) => s.isInitialized)
  const isTerminated = useRuntimeStore((s) => s.isTerminated)
  const items = useCourseStore((s) => s.items)
  const progress = useCourseStore((s) => s.progress)
  const sequenced = useCourseStore((s) => s.sequenced)
  const currentItemId = useCourseStore((s) => s.currentItemId)

  const reportData = useMemo<ReportData | null>(() => {
    if (!pkg || !manifest) return null
    return ReportBuilderService.buildReportData({
      pkg,
      manifest,
      course: {
        sequenced,
        currentItemTitle: items.find((item) => item.identifier === currentItemId)?.title ?? null,
        items: items.map((item) => {
          const summary = progress[item.identifier]
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
      sessionId,
      scormVersion,
      isInitialized,
      isTerminated,
      apiCalls: records,
      snapshots,
      validationIssues,
    })
  }, [
    pkg,
    manifest,
    items,
    progress,
    sequenced,
    currentItemId,
    sessionId,
    scormVersion,
    isInitialized,
    isTerminated,
    records,
    snapshots,
    validationIssues,
  ])

  const exportReport = useCallback(
    (format: ReportFormat) => {
      if (!reportData) return
      download(SERIALIZERS[format](reportData), reportFilename(pkg?.name ?? null, format), MIME_TYPES[format])
    },
    [reportData, pkg],
  )

  return { reportData, exportReport }
}
