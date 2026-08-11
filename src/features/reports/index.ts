/**
 * Public surface of the "reports" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 *
 * Populated incrementally — see /docs/ROADMAP.md for which milestone fills
 * this in.
 */
export { ReportsPanel } from './components/ReportsPanel'
export { ReportBuilderService } from './services/ReportBuilderService'
export type { ReportData, ReportFormat } from './services/ReportBuilderService'
