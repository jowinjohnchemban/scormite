import { describe, expect, it } from 'vitest'
import { ReportBuilderService, type BuildReportOptions } from '../services/ReportBuilderService'
import type { ApiCallRecord } from '@/shared/types'

describe('ReportBuilderService', () => {
  const baseData: BuildReportOptions = {
    pkg: {
      id: 'pkg-1',
      name: 'Sample Course',
      sourceType: 'zip',
      scormVersion: '1.2',
      launchUrl: 'index.html',
      loadedAt: new Date('2025-01-01T00:00:00Z'),
      manifest: {
        organizations: [],
        resources: [],
        metadata: { title: 'Sample Course' },
      },
    },
    manifest: {
      organizations: [],
      resources: [],
      metadata: { title: 'Sample Course' },
    },
    sessionId: 'session-1',
    activeProfileId: 'strict-adl',
    scormVersion: '1.2',
    isInitialized: true,
    isTerminated: false,
    apiCalls: [
      {
        id: 'call-1',
        sessionId: 'session-1',
        timestamp: 1700000000000,
        method: 'Initialize',
        returnValue: 'true',
        durationMs: 1.2,
      } as ApiCallRecord,
    ],
    snapshots: [
      {
        timestamp: 1700000000000,
        sessionId: 'session-1',
        data: { 'cmi.core.lesson_status': 'incomplete' },
        changedPaths: ['cmi.core.lesson_status'],
      },
    ],
    validationIssues: [
      {
        id: 'issue-1',
        severity: 'warning',
        source: 'runtime',
        message: 'Test warning',
        ruleId: 'runtime.test-warning',
      },
    ],
  }

  it('builds report data with package and runtime summaries', () => {
    const report = ReportBuilderService.buildReportData(baseData)

    expect(report.package.name).toBe('Sample Course')
    expect(report.runtime.sessionId).toBe('session-1')
    expect(report.apiCalls).toHaveLength(1)
    expect(report.validationIssues).toHaveLength(1)
  })

  it('serializes JSON and includes manifest title', () => {
    const report = ReportBuilderService.buildReportData(baseData)
    const json = ReportBuilderService.serializeJson(report)
    expect(json).toContain('Sample Course')
    expect(json).toContain('runtime.test-warning')
  })

  it('serializes markdown with sections for logs and snapshots', () => {
    const report = ReportBuilderService.buildReportData(baseData)
    const markdown = ReportBuilderService.serializeMarkdown(report)
    expect(markdown).toContain('## API Log')
    expect(markdown).toContain('## Timeline Snapshots')
    expect(markdown).toContain('Initialize')
  })

  it('serializes HTML as standalone markup', () => {
    const report = ReportBuilderService.buildReportData(baseData)
    const html = ReportBuilderService.serializeHtml(report)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('SCORMite QA Report')
    expect(html).toContain('Sample Course')
  })
})
