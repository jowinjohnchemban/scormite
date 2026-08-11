import { useMemo } from 'react'
import { ReportBuilderService, type ReportData, type ReportFormat } from '@/features/reports'
import { ReportsPanel } from '@/features/reports'
import { usePackageStore } from '@/features/package-loader'
import { useManifestStore } from '@/features/manifest'
import { useLogStore } from '@/features/logging'
import { useTimelineStore } from '@/features/timeline'
import { useValidationStore } from '@/features/validation'
import { useRuntimeStore } from '@/features/runtime'
import { useActiveProfile } from '@/features/settings'

const MIME_TYPES: Record<ReportFormat, string> = {
  json: 'application/json;charset=UTF-8',
  csv: 'text/csv;charset=UTF-8',
  markdown: 'text/markdown;charset=UTF-8',
  html: 'text/html;charset=UTF-8',
}

function createFilename(pkgName: string | null, format: ReportFormat): string {
  const safeName = (pkgName ?? 'package').replace(/[^a-zA-Z0-9-_]/g, '_')
  return `scormite-report-${safeName}-${new Date().toISOString()}.${format}`
}

export function ReportsPanelWrapper() {
  const pkg = usePackageStore((s) => s.package)
  const manifest = useManifestStore((s) => s.manifest)
  const records = useLogStore((s) => s.records)
  const snapshots = useTimelineStore((s) => s.snapshots)
  const validationIssues = useValidationStore((s) => s.issues)
  const sessionId = useRuntimeStore((s) => s.sessionId)
  const scormVersion = useRuntimeStore((s) => s.scormVersion)
  const isInitialized = useRuntimeStore((s) => s.isInitialized)
  const isTerminated = useRuntimeStore((s) => s.isTerminated)
  const activeProfile = useActiveProfile()

  const ready = pkg !== null && manifest !== null

  const reportData = useMemo<ReportData | null>(() => {
    if (!pkg || !manifest) return null
    return ReportBuilderService.buildReportData({
      pkg,
      manifest,
      sessionId,
      activeProfileId: activeProfile.id,
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
    sessionId,
    activeProfile.id,
    scormVersion,
    isInitialized,
    isTerminated,
    records,
    snapshots,
    validationIssues,
  ])

  const handleExport = (format: ReportFormat) => {
    if (!reportData) return

    let content: string
    switch (format) {
      case 'json':
        content = ReportBuilderService.serializeJson(reportData)
        break
      case 'csv':
        content = ReportBuilderService.serializeCsv(reportData)
        break
      case 'markdown':
        content = ReportBuilderService.serializeMarkdown(reportData)
        break
      case 'html':
        content = ReportBuilderService.serializeHtml(reportData)
        break
      default:
        content = ReportBuilderService.serializeJson(reportData)
    }

    const filename = createFilename(pkg?.name ?? null, format)
    const blob = new Blob([content], { type: MIME_TYPES[format] })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return <ReportsPanel reportData={reportData} ready={ready} onExport={handleExport} />
}
