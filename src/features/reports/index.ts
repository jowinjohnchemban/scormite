/**
 * Public surface of the "reports" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { ReportBuilderService } from './services/ReportBuilderService'
export type { ReportData, ReportFormat } from './services/ReportBuilderService'
