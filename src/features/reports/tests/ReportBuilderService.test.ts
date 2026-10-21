import { describe, expect, it } from 'vitest'
import {
  ReportBuilderService,
  type BuildReportOptions,
} from '../services/ReportBuilderService'
import type { Manifest, Package } from '@/shared/types'

const mockManifest: Manifest = {
  metadata: { schema: 'ADL SCORM', schemaVersion: '1.2' },
  organizations: [
    {
      identifier: 'org-1',
      title: 'Sample Course',
      items: [
        {
          identifier: 'item-1',
          identifierref: 'res-1',
          title: 'Module 1',
          isvisible: true,
          children: [],
        },
      ],
    },
  ],
  defaultOrganizationIdentifier: 'org-1',
  resources: [
    {
      identifier: 'res-1',
      type: 'webcontent',
      scormType: 'sco',
      href: 'index.html',
      files: ['index.html'],
    },
  ],
}

const mockPackage: Package = {
  id: 'pkg-123',
  name: 'Test Package',
  sourceType: 'zip',
  scormVersion: '1.2',
  manifest: mockManifest,
  launchUrl: 'index.html',
  loadedAt: new Date('2024-01-01T00:00:00.000Z'),
}

const baseOptions: BuildReportOptions = {
  pkg: mockPackage,
  manifest: mockManifest,
  course: {
    sequenced: false,
    currentItemTitle: 'Module 1',
    items: [
      { identifier: 'item-1', title: 'Module 1', scormType: 'sco', completionStatus: 'passed', successStatus: 'passed', score: '90' },
    ],
  },
  sessionId: 'session-456',
  scormVersion: '1.2',
  isInitialized: true,
  isTerminated: false,
  apiCalls: [
    {
      id: 'call-1',
      sessionId: 'session-456',
      method: 'Initialize',
      returnValue: 'true',
      durationMs: 1.2,
      timestamp: 1704067200000,
    },
  ],
  snapshots: [
    {
      timestamp: 1704067200000,
      sessionId: 'session-456',
      data: { 'cmi.core.lesson_status': 'incomplete' },
      changedPaths: ['cmi.core.lesson_status'],
    },
  ],
  validationIssues: [
    {
      id: 'issue-1',
      severity: 'warning',
      source: 'runtime',
      ruleId: 'runtime.missing-commit',
      message: 'Course terminated without a successful Commit.',
    },
  ],
}

describe('ReportBuilderService', () => {
  const failed = {
    id: 'call-2',
    sessionId: 'session-456',
    method: 'SetValue' as const,
    element: 'cmi.core.score.raw',
    value: 'a|b',
    returnValue: 'false',
    errorCode: '405',
    errorString: 'Incorrect Data Type',
    durationMs: 0,
    timestamp: 1704067201000,
  }
  const options = { ...baseOptions, apiCalls: [...baseOptions.apiCalls, failed] }

  it('builds structured report data with course results and failure counts', () => {
    const data = ReportBuilderService.buildReportData(options)
    expect(data.package.name).toBe('Test Package')
    expect(data.course.items[0]).toMatchObject({ title: 'Module 1', successStatus: 'passed', score: '90' })
    expect(data.runtime).toMatchObject({ apiCallCount: 2, failedCallCount: 1, isInitialized: true })
  })

  it('serializes the whole report as JSON', () => {
    const parsed = JSON.parse(ReportBuilderService.serializeJson(ReportBuilderService.buildReportData(options)))
    expect(parsed.package.id).toBe('pkg-123')
    expect(parsed.course.items).toHaveLength(1)
  })

  it('serializes the API log as one flat CSV table with error explanations', () => {
    const csv = ReportBuilderService.serializeCsv(ReportBuilderService.buildReportData(options))
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('Time,Method,Element,Value,Result,Error')
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('405 — Incorrect Data Type')
  })

  it('serializes Markdown with course results and escaped table cells', () => {
    const md = ReportBuilderService.serializeMarkdown(ReportBuilderService.buildReportData(options))
    expect(md).toContain('# SCORMite QA report')
    expect(md).toContain('## Course results')
    expect(md).toContain('| Module 1 | sco | passed | passed | 90 |')
    expect(md).toContain('a\\|b')
  })

  it('serializes standalone, escaped, print-friendly HTML', () => {
    const html = ReportBuilderService.serializeHtml(
      ReportBuilderService.buildReportData({ ...options, pkg: { ...mockPackage, name: '<Quiz>' } }),
    )
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('&lt;Quiz&gt;')
    expect(html).not.toContain('<Quiz>')
    expect(html).toContain('@media print')
    expect(html).toContain('class="failed"')
  })
})
