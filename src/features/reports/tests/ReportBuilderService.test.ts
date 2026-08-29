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
  sessionId: 'session-456',
  activeProfileId: 'strict-adl',
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
  it('builds structured report data', () => {
    const data = ReportBuilderService.buildReportData(baseOptions)
    expect(data.package.name).toBe('Test Package')
    expect(data.package.scormVersion).toBe('1.2')
    expect(data.runtime.isInitialized).toBe(true)
    expect(data.runtime.isTerminated).toBe(false)
    expect(data.apiCalls).toHaveLength(1)
    expect(data.snapshots).toHaveLength(1)
    expect(data.validationIssues).toHaveLength(1)
  })

  it('serializes report as valid JSON', () => {
    const data = ReportBuilderService.buildReportData(baseOptions)
    const json = ReportBuilderService.serializeJson(data)
    const parsed = JSON.parse(json)
    expect(parsed.package.id).toBe('pkg-123')
    expect(parsed.runtime.sessionId).toBe('session-456')
  })

  it('serializes report as CSV with summary and tables', () => {
    const data = ReportBuilderService.buildReportData(baseOptions)
    const csv = ReportBuilderService.serializeCsv(data)
    expect(csv).toContain('Section,Field,Value')
    expect(csv).toContain('Package,Name,Test Package')
    expect(csv).toContain('Runtime,Initialized,true')
    expect(csv).toContain('Initialize')
  })

  it('serializes report as Markdown with tables and manifest JSON', () => {
    const data = ReportBuilderService.buildReportData(baseOptions)
    const md = ReportBuilderService.serializeMarkdown(data)
    expect(md).toContain('# SCORMite QA Report')
    expect(md).toContain('## Package Summary')
    expect(md).toContain('Test Package')
    expect(md).toContain('Initialize')
  })

  it('serializes report as standalone HTML', () => {
    const data = ReportBuilderService.buildReportData(baseOptions)
    const html = ReportBuilderService.serializeHtml(data)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<h1>SCORMite QA Report</h1>')
    expect(html).toContain('Test Package')
  })
})
