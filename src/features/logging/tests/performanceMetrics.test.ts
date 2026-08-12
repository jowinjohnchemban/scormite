/**
 * Unit tests for computePerformanceMetrics + safeMs — pure API-call aggregation.
 */

import { describe, expect, it } from 'vitest'
import { computePerformanceMetrics, safeMs } from '../services/performanceMetrics'
import type { ApiCallRecord } from '@/shared/types'

function record(partial: Partial<ApiCallRecord> & { method: ApiCallRecord['method'] }): ApiCallRecord {
  return {
    id: partial.id ?? 'id',
    sessionId: 'sess-1',
    timestamp: 0,
    element: undefined,
    value: undefined,
    returnValue: '0',
    durationMs: partial.durationMs ?? 1,
    errorCode: partial.errorCode,
    ...partial,
  }
}

describe('computePerformanceMetrics', () => {
  it('returns the zero-state for no records', () => {
    expect(computePerformanceMetrics([])).toEqual({
      total: 0,
      errorCount: 0,
      avgMs: 0,
      p95Ms: 0,
      maxMs: 0,
      slowest: [],
      byMethod: [],
    })
  })

  it('computes totals, averages, and maxima over one record', () => {
    const metrics = computePerformanceMetrics([
      record({ method: 'GetValue', durationMs: 10 }),
    ])
    expect(metrics.total).toBe(1)
    expect(metrics.avgMs).toBe(10)
    expect(metrics.maxMs).toBe(10)
    expect(metrics.p95Ms).toBe(10)
    expect(metrics.errorCount).toBe(0)
    expect(metrics.slowest).toHaveLength(1)
    expect(metrics.byMethod).toEqual([
      { method: 'GetValue', count: 1, errorCount: 0, avgMs: 10, maxMs: 10 },
    ])
  })

  it('counts records with an errorCode as errors', () => {
    const metrics = computePerformanceMetrics([
      record({ method: 'SetValue', durationMs: 5, errorCode: '101' }),
      record({ method: 'SetValue', durationMs: 5 }),
    ])
    expect(metrics.errorCount).toBe(1)
    expect(metrics.byMethod[0]).toMatchObject({ count: 2, errorCount: 1 })
  })

  it('computes p95 across a larger sample', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      record({ method: 'GetValue', durationMs: i + 1 }),
    )
    const metrics = computePerformanceMetrics(records)
    // p95 index = ceil(20 * 0.95) - 1 = 18 → 19th value (1-based) = 19
    expect(metrics.p95Ms).toBe(19)
    expect(metrics.maxMs).toBe(20)
    expect(metrics.avgMs).toBe(10.5)
  })

  it('caps slowest at the top five by duration', () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record({ method: 'GetValue', durationMs: i + 1 }),
    )
    const metrics = computePerformanceMetrics(records)
    expect(metrics.slowest).toHaveLength(5)
    expect(metrics.slowest[0]?.durationMs).toBe(8)
    expect(metrics.slowest[4]?.durationMs).toBe(4)
  })

  it('groups by method and sorts by call count descending', () => {
    const metrics = computePerformanceMetrics([
      record({ method: 'Commit', durationMs: 1 }),
      record({ method: 'GetValue', durationMs: 2 }),
      record({ method: 'GetValue', durationMs: 3 }),
      record({ method: 'Terminate', durationMs: 4 }),
    ])
    expect(metrics.byMethod.map((m) => m.method)).toEqual([
      'GetValue',
      'Commit',
      'Terminate',
    ])
    const getValue = metrics.byMethod.find((m) => m.method === 'GetValue')
    expect(getValue).toMatchObject({ count: 2, avgMs: 2.5, maxMs: 3 })
  })
})

describe('safeMs', () => {
  it('formats finite values to one decimal', () => {
    expect(safeMs(12.345)).toBe('12.3')
    expect(safeMs(0)).toBe('0.0')
  })

  it('returns an em dash for non-finite values', () => {
    expect(safeMs(Number.NaN)).toBe('—')
    expect(safeMs(Number.POSITIVE_INFINITY)).toBe('—')
  })
})
