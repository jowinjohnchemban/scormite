import type { ApiCallRecord, CmiSnapshot, Manifest, Package, ValidationIssue } from '@/shared/types'

export type ReportFormat = 'json' | 'csv' | 'markdown' | 'html'

/** One course item's result at the time of the report. */
export interface CourseItemResult {
  identifier: string
  title: string
  scormType: 'sco' | 'asset'
  completionStatus: string
  successStatus: string
  score: string
}

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
  course: {
    /** True when SCORM 2004 sequencing rules drove navigation. */
    sequenced: boolean
    currentItemTitle: string | null
    items: CourseItemResult[]
  }
  runtime: {
    sessionId: string | null
    scormVersion: string | null
    /** Of the current item's attempt. */
    isInitialized: boolean
    /** Of the current item's attempt. */
    isTerminated: boolean
    apiCallCount: number
    failedCallCount: number
    snapshotCount: number
    validationIssueCount: number
  }
  manifest: Manifest
  apiCalls: ApiCallRecord[]
  /** CMI changes of the current item's attempt. */
  snapshots: CmiSnapshot[]
  validationIssues: ValidationIssue[]
}

export interface BuildReportOptions {
  pkg: Package
  manifest: Manifest
  course: ReportData['course']
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
  if (/[,"]/.test(sanitized)) {
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

/** A Markdown table cell: pipes escaped, line breaks flattened. */
function mdCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, ' ') || ' '
}

function errorText(record: ApiCallRecord): string {
  if (!record.errorCode) return ''
  return [record.errorCode, record.errorString, record.diagnostic].filter(Boolean).join(' — ')
}

function packageRows(report: ReportData): [string, string][] {
  return [
    ['Name', report.package.name],
    ['SCORM version', `${report.package.scormVersion}${report.package.scormEdition ? ` (${report.package.scormEdition} Edition)` : ''}`],
    ['First launch', report.package.launchUrl],
    ['Loaded at', report.package.loadedAt],
    ['Resources', String(report.package.resourceCount)],
    ['Organizations', String(report.package.organizationCount)],
  ]
}

function runtimeRows(report: ReportData): [string, string][] {
  return [
    ['Navigation', report.course.sequenced ? 'SCORM 2004 sequencing rules' : 'Manifest order'],
    ['Current item', report.course.currentItemTitle ?? 'None'],
    ['Current item initialized', String(report.runtime.isInitialized)],
    ['Current item terminated', String(report.runtime.isTerminated)],
    ['API calls', String(report.runtime.apiCallCount)],
    ['Failed API calls', String(report.runtime.failedCallCount)],
    ['Validation issues', String(report.runtime.validationIssueCount)],
  ]
}

const COURSE_HEADERS = ['Item', 'Type', 'Completion', 'Success', 'Score']
const courseRow = (item: CourseItemResult): string[] => [
  item.title,
  item.scormType,
  item.completionStatus,
  item.successStatus,
  item.score || '—',
]

const ISSUE_HEADERS = ['Severity', 'Rule', 'Location', 'Message']
const issueRow = (issue: ValidationIssue): string[] => [issue.severity, issue.ruleId, issue.location ?? '—', issue.message]

const CALL_HEADERS = ['Time', 'Method', 'Element', 'Value', 'Result', 'Error']
const callRow = (record: ApiCallRecord): string[] => [
  formatTimestamp(record.timestamp),
  record.method,
  record.element ?? '',
  record.value ?? '',
  record.returnValue,
  errorText(record),
]

export const ReportBuilderService = {
  buildReportData({
    pkg,
    manifest,
    course,
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
        ...(pkg.scormEdition !== undefined ? { scormEdition: pkg.scormEdition } : {}),
        launchUrl: pkg.launchUrl,
        loadedAt: formatTimestamp(pkg.loadedAt),
        resourceCount: manifest.resources.length,
        organizationCount: manifest.organizations.length,
      },
      course,
      runtime: {
        sessionId,
        scormVersion,
        isInitialized,
        isTerminated,
        apiCallCount: apiCalls.length,
        failedCallCount: apiCalls.filter((record) => record.errorCode).length,
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

  /** The API log as one flat table — what a spreadsheet can actually use. */
  serializeCsv(report: ReportData): string {
    const lines = [CALL_HEADERS.join(',')]
    for (const record of report.apiCalls) lines.push(callRow(record).map(escapeCsv).join(','))
    return `${lines.join('\n')}\n`
  },

  serializeMarkdown(report: ReportData): string {
    const list = (rows: [string, string][]) => rows.map(([label, value]) => `- **${label}:** ${value}`).join('\n')
    const table = (headers: string[], rows: string[][]) =>
      [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`),
      ].join('\n')

    return [
      '# SCORMite QA report',
      '',
      `Generated ${report.generatedAt}`,
      '',
      '## Package',
      '',
      list(packageRows(report)),
      '',
      '## Course results',
      '',
      table(COURSE_HEADERS, report.course.items.map(courseRow)),
      '',
      '## Runtime',
      '',
      list(runtimeRows(report)),
      '',
      '## Validation issues',
      '',
      report.validationIssues.length === 0
        ? 'No validation issues found.'
        : table(ISSUE_HEADERS, report.validationIssues.map(issueRow)),
      '',
      '## API log',
      '',
      report.apiCalls.length === 0 ? 'No API calls recorded.' : table(CALL_HEADERS, report.apiCalls.map(callRow)),
      '',
      '## Data changes of the current item',
      '',
      report.snapshots.length === 0
        ? 'No data changes recorded.'
        : table(
            ['#', 'Time', 'Changed elements'],
            report.snapshots.map((snapshot, index) => [
              String(index + 1),
              formatTimestamp(snapshot.timestamp),
              snapshot.changedPaths.join(', '),
            ]),
          ),
      '',
    ].join('\n')
  },

  serializeHtml(report: ReportData): string {
    const kv = (rows: [string, string][]) =>
      `<table>${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>`
    const table = (headers: string[], rows: string[][], rowClass?: (index: number) => string) =>
      `<table><thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((row, index) => `<tr${rowClass ? ` class="${rowClass(index)}"` : ''}>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SCORMite QA report — ${escapeHtml(report.package.name)}</title>
<style>
  :root { color-scheme: light dark; --bg: #0b0d10; --panel: #101317; --text: #e6edf3; --muted: #7f93ab; --border: #262b33; --bad: #f85149; --warn: #d29922; }
  @media (prefers-color-scheme: light) { :root { --bg: #ffffff; --panel: #f6f8fa; --text: #1f2328; --muted: #57606a; --border: #d0d7de; --bad: #cf222e; --warn: #9a6700; } }
  @media print { :root { --bg: #ffffff; --panel: #ffffff; --text: #000000; --muted: #444444; --border: #999999; --bad: #b00020; --warn: #7a5200; } }
  body { margin: 0; padding: 2rem 1rem; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { max-width: 72rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; }
  p.meta { color: var(--muted); margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0; font-size: 13px; }
  th, td { border: 1px solid var(--border); padding: .4rem .6rem; text-align: left; vertical-align: top; word-break: break-word; }
  thead th, th[scope="row"] { background: var(--panel); font-weight: 600; }
  th[scope="row"] { width: 14rem; }
  tr.failed td { color: var(--bad); }
  td:empty::after { content: '—'; color: var(--muted); }
  .error { color: var(--bad); } .warning { color: var(--warn); }
  @media print { h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <h1>SCORMite QA report</h1>
  <p class="meta">${escapeHtml(report.package.name)} · generated ${escapeHtml(report.generatedAt)}</p>

  <h2>Package</h2>
  ${kv(packageRows(report))}

  <h2>Course results</h2>
  ${table(COURSE_HEADERS, report.course.items.map(courseRow))}

  <h2>Runtime</h2>
  ${kv(runtimeRows(report))}

  <h2>Validation issues</h2>
  ${
    report.validationIssues.length === 0
      ? '<p>No validation issues found.</p>'
      : table(ISSUE_HEADERS, report.validationIssues.map(issueRow), (index) => report.validationIssues[index]?.severity ?? '')
  }

  <h2>API log</h2>
  ${
    report.apiCalls.length === 0
      ? '<p>No API calls recorded.</p>'
      : table(CALL_HEADERS, report.apiCalls.map(callRow), (index) => (report.apiCalls[index]?.errorCode ? 'failed' : ''))
  }

  <h2>Data changes of the current item</h2>
  ${
    report.snapshots.length === 0
      ? '<p>No data changes recorded.</p>'
      : table(
          ['#', 'Time', 'Changed elements'],
          report.snapshots.map((snapshot, index) => [
            String(index + 1),
            formatTimestamp(snapshot.timestamp),
            snapshot.changedPaths.join(', '),
          ]),
        )
  }
</main>
</body>
</html>
`
  },
}
