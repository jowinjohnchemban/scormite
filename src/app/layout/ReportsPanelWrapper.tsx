import { ReportsPanel } from '@/features/reports'
import { useReportExport } from '@/app/hooks/useReportExport'

/** Feeds the Reports panel from the live session (see `useReportExport`). */
export function ReportsPanelWrapper() {
  const { reportData, exportReport } = useReportExport()
  return <ReportsPanel reportData={reportData} ready={reportData !== null} onExport={exportReport} />
}
