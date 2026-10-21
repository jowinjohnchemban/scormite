import type { Manifest } from '@/shared/types'
import type { ApiCallRecord, CmiSnapshot, Package, ValidationIssue } from '@/shared/types'

export type ReportFormat = 'json' | 'csv' | 'markdown' | 'html'

export interface ReportData {
  generatedAt: string
  package: {
    id: string
    name: string
    sourceType: Package['sourceType']
    scormVersion: Package['scormVersion']
    scormEdition?: Package['scormEdition']
    launchUrl: string
    loadedAt: string
    resourceCount: number
    organizationCount: number
  }
  runtime: {
    sessionId: string | null
    scormVersion: string | null
    isInitialized: boolean
    isTerminated: boolean
    apiCallCount: number
    snapshotCount: number
    validationIssueCount: number
  }
  manifest: Manifest
  apiCalls: ApiCallRecord[]
  snapshots: CmiSnapshot[]
  validationIssues: ValidationIssue[]
}

export interface BuildReportOptions {
  pkg: Package
  manifest: Manifest
  sessionId: string | null
  scormVersion: string | null
  isInitialized: boolean
  isTerminated: boolean
  apiCalls: ApiCallRecord[]
  snapshots: CmiSnapshot[]
  validationIssues: ValidationIssue[]
}

function formatTimestamp(value: string | number | Date): string {
  return new Date(value).toISOString()
}

function escapeCsv(value: string): string {
  const sanitized = value.replace(/\r\n|\r|\n/g, ' ')
  if (/[,"\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const ReportBuilderService = {
  buildReportData({
    pkg,
    manifest,
    sessionId,
    scormVersion,
    isInitialized,
    isTerminated,
    apiCalls,
    snapshots,
    validationIssues,
  }: BuildReportOptions): ReportData {
    return {
      generatedAt: new Date().toISOString(),
      package: {
        id: pkg.id,
        name: pkg.name,
        sourceType: pkg.sourceType,
        scormVersion: pkg.scormVersion,
        scormEdition: pkg.scormEdition,
        launchUrl: pkg.launchUrl,
        loadedAt: formatTimestamp(pkg.loadedAt),
        resourceCount: manifest.resources.length,
        organizationCount: manifest.organizations.length,
      },
      runtime: {
        sessionId,
        scormVersion,
        isInitialized,
        isTerminated,
        apiCallCount: apiCalls.length,
        snapshotCount: snapshots.length,
        validationIssueCount: validationIssues.length,
      },
      manifest,
      apiCalls,
      snapshots,
      validationIssues,
    }
  },

  serializeJson(report: ReportData): string {
    return JSON.stringify(report, null, 2)
  },

  serializeCsv(report: ReportData): string {
    const lines: string[] = []
    const headerRow = ['Section', 'Field', 'Value']
    lines.push(headerRow.join(','))

    const addSummary = (section: string, rows: Array<[string, string]>) => {
      for (const [field, value] of rows) {
        lines.push([section, field, escapeCsv(value)].join(','))
      }
    }

    addSummary('Package', [
      ['Name', report.package.name],
      ['SCORM Version', report.package.scormVersion],
      ['SCORM Edition', report.package.scormEdition ?? 'N/A'],
      ['Launch URL', report.package.launchUrl],
      ['Loaded At', report.package.loadedAt],
      ['Resource Count', String(report.package.resourceCount)],
      ['Organization Count', String(report.package.organizationCount)],
    ])

    addSummary('Runtime', [
      ['Session ID', report.runtime.sessionId ?? 'None'],
      ['SCORM Version', report.runtime.scormVersion ?? 'Unknown'],
      ['Initialized', String(report.runtime.isInitialized)],
      ['Terminated', String(report.runtime.isTerminated)],
      ['API Call Count', String(report.runtime.apiCallCount)],
      ['Snapshot Count', String(report.runtime.snapshotCount)],
      ['Validation Issue Count', String(report.runtime.validationIssueCount)],
    ])

    lines.push('')
    lines.push(['Logs', 'Timestamp', 'Method', 'Element', 'Value', 'Result', 'Error', 'Duration (ms)'].join(','))
    for (const record of report.apiCalls) {
      lines.push([
        'log',
        escapeCsv(formatTimestamp(record.timestamp)),
        escapeCsv(record.method),
        escapeCsv(record.element ?? ''),
        escapeCsv(record.value ?? ''),
        escapeCsv(record.returnValue ?? ''),
        escapeCsv(record.errorCode ?? ''),
        escapeCsv(record.durationMs.toFixed(1)),
      ].join(','))
    }

    lines.push('')
    lines.push(['Timeline', 'Snapshot Index', 'Timestamp', 'Changed Paths'].join(','))
    report.snapshots.forEach((snapshot, index) => {
      lines.push([
        'timeline',
        String(index + 1),
        escapeCsv(formatTimestamp(snapshot.timestamp)),
        escapeCsv(snapshot.changedPaths.join('; ')),
      ].join(','))
    })

    lines.push('')
    lines.push(['Validation', 'Rule ID', 'Location', 'Severity', 'Message'].join(','))
    for (const issue of report.validationIssues) {
      lines.push([
        'issue',
        escapeCsv(issue.ruleId),
        escapeCsv(issue.location ?? ''),
        escapeCsv(issue.severity),
        escapeCsv(issue.message),
      ].join(','))
    }

    return lines.join('\n')
  },

  serializeMarkdown(report: ReportData): string {
    const summaryRows = (section: string, rows: Array<[string, string]>): string =>
      `### ${section}\n\n${rows.map(([label, value]) => `- **${label}:** ${value}`).join('\n')}\n`

    const renderTable = (headers: string[], rows: string[][]): string => {
      const headerLine = `| ${headers.join(' | ')} |`
      const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`
      const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
      return `${headerLine}\n${dividerLine}\n${body}`
    }

    return [
      `# SCORMite QA Report`,
      `Generated: ${report.generatedAt}`,
      '',
      `## Package Summary`,
      summaryRows('Package', [
        ['Name', report.package.name],
        ['SCORM Version', report.package.scormVersion],
        ['SCORM Edition', report.package.scormEdition ?? 'N/A'],
        ['Launch URL', report.package.launchUrl],
        ['Loaded At', report.package.loadedAt],
        ['Resource Count', String(report.package.resourceCount)],
        ['Organization Count', String(report.package.organizationCount)],
      ]),
      `## Runtime Summary`,
      summaryRows('Runtime', [
        ['Session ID', report.runtime.sessionId ?? 'None'],
        ['SCORM Version', report.runtime.scormVersion ?? 'Unknown'],
        ['Initialized', String(report.runtime.isInitialized)],
        ['Terminated', String(report.runtime.isTerminated)],
        ['API Call Count', String(report.runtime.apiCallCount)],
        ['Snapshot Count', String(report.runtime.snapshotCount)],
        ['Validation Issue Count', String(report.runtime.validationIssueCount)],
      ]),
      `## Validation Issues`,
      report.validationIssues.length === 0
        ? 'No validation issues found.'
        : renderTable(
            ['Rule ID', 'Location', 'Severity', 'Message'],
            report.validationIssues.map((issue) => [
              issue.ruleId,
              issue.location ?? 'N/A',
              issue.severity,
              issue.message,
            ]),
          ),
      '',
      `## Timeline Snapshots`,
      report.snapshots.length === 0
        ? 'No timeline snapshots captured.'
        : renderTable(
            ['Index', 'Timestamp', 'Changed Paths'],
            report.snapshots.map((snapshot, index) => [
              String(index + 1),
              formatTimestamp(snapshot.timestamp),
              snapshot.changedPaths.join(', '),
            ]),
          ),
      '',
      `## API Log`,
      report.apiCalls.length === 0
        ? 'No API calls recorded.'
        : renderTable(
            ['Time', 'Method', 'Element', 'Value', 'Result', 'Error', 'Duration (ms)'],
            report.apiCalls.map((record) => [
              formatTimestamp(record.timestamp),
              record.method,
              record.element ?? '—',
              record.value ?? '—',
              record.returnValue,
              record.errorCode ?? 'None',
              record.durationMs.toFixed(1),
            ]),
          ),
      '',
      `## Raw Manifest`,
      '```json',
      JSON.stringify(report.manifest, null, 2),
      '```',
    ].join('\n')
  },

  serializeHtml(report: ReportData): string {
    const rows = (cells: string[]) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
    const sectionTable = (rowsContent: string[]) => `<table>${rowsContent.join('')}</table>`
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SCORMite QA Report</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; color: #e2e8f0; background: #0f172a; margin: 0; padding: 1.5rem; }
    .container { max-width: 1040px; margin: 0 auto; }
    h1, h2, h3 { color: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { padding: 0.75rem 0.85rem; border: 1px solid #334155; }
    th { background: #1e293b; text-align: left; }
    tr:nth-child(even) td { background: #0f172a; }
    tr:nth-child(odd) td { background: #0b1120; }
    pre { background: #020617; padding: 1rem; overflow: auto; border: 1px solid #334155; }
    .badge { display: inline-flex; padding: 0.15rem 0.5rem; border-radius: 9999px; background: #334155; color: #cbd5e1; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SCORMite QA Report</h1>
    <p class="badge">Generated ${escapeHtml(report.generatedAt)}</p>

    <h2>Package Summary</h2>
    ${sectionTable([
      '<tr><th>Field</th><th>Value</th></tr>',
      rows(['Name', escapeHtml(report.package.name)]),
      rows(['SCORM Version', escapeHtml(report.package.scormVersion)]),
      rows(['SCORM Edition', escapeHtml(report.package.scormEdition ?? 'N/A')]),
      rows(['Launch URL', escapeHtml(report.package.launchUrl)]),
      rows(['Loaded At', escapeHtml(report.package.loadedAt)]),
      rows(['Resource Count', String(report.package.resourceCount)]),
      rows(['Organization Count', String(report.package.organizationCount)]),
    ])}

    <h2>Runtime Summary</h2>
    ${sectionTable([
      '<tr><th>Field</th><th>Value</th></tr>',
      rows(['Session ID', escapeHtml(report.runtime.sessionId ?? 'None')]),
      rows(['SCORM Version', escapeHtml(report.runtime.scormVersion ?? 'Unknown')]),
      rows(['Initialized', String(report.runtime.isInitialized)]),
      rows(['Terminated', String(report.runtime.isTerminated)]),
      rows(['API Call Count', String(report.runtime.apiCallCount)]),
      rows(['Snapshot Count', String(report.runtime.snapshotCount)]),
      rows(['Validation Issue Count', String(report.runtime.validationIssueCount)]),
    ])}

    <h2>Validation Issues</h2>
    ${report.validationIssues.length === 0 ? '<p>No validation issues found.</p>' : sectionTable([
      '<tr><th>Rule ID</th><th>Location</th><th>Severity</th><th>Message</th></tr>',
      ...report.validationIssues.map((issue) => rows([
        escapeHtml(issue.ruleId),
        escapeHtml(issue.location ?? 'N/A'),
        escapeHtml(issue.severity),
        escapeHtml(issue.message),
      ])),
    ])}

    <h2>Timeline Snapshots</h2>
    ${report.snapshots.length === 0 ? '<p>No timeline snapshots captured.</p>' : sectionTable([
      '<tr><th>#</th><th>Timestamp</th><th>Changed Paths</th></tr>',
      ...report.snapshots.map((snapshot, index) => rows([
        String(index + 1),
        escapeHtml(formatTimestamp(snapshot.timestamp)),
        escapeHtml(snapshot.changedPaths.join(', ')),
      ])),
    ])}

    <h2>API Log</h2>
    ${report.apiCalls.length === 0 ? '<p>No API calls recorded.</p>' : sectionTable([
      '<tr><th>Time</th><th>Method</th><th>Element</th><th>Value</th><th>Result</th><th>Error</th><th>Duration (ms)</th></tr>',
      ...report.apiCalls.map((record) => rows([
        escapeHtml(formatTimestamp(record.timestamp)),
        escapeHtml(record.method),
        escapeHtml(record.element ?? '—'),
        escapeHtml(record.value ?? '—'),
        escapeHtml(record.returnValue),
        escapeHtml(record.errorCode ?? 'None'),
        escapeHtml(record.durationMs.toFixed(1)),
      ])),
    ])}

    <h2>Raw Manifest</h2>
    <pre>${escapeHtml(JSON.stringify(report.manifest, null, 2))}</pre>
  </div>
</body>
</html>`
    return html
  },
}
