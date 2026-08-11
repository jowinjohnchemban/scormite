/**
 * Pure aggregation over the recorded SCORM API calls. Everything here is
 * derived from real ApiCallRecords — no sampling, no mock data.
 */

import type { ApiCallRecord } from '@/shared/types'

export interface MethodStats {
  method: string
  count: number
  errorCount: number
  avgMs: number
  maxMs: number
}

export interface PerformanceMetrics {
  total: number
  errorCount: number
  avgMs: number
  p95Ms: number
  maxMs: number
  /** Top 5 slowest calls, fastest of the five last. */
  slowest: ApiCallRecord[]
  byMethod: MethodStats[]
}

const SLOWEST_TO_SHOW = 5

export function computePerformanceMetrics(records: readonly ApiCallRecord[]): PerformanceMetrics {
  const total = records.length

  if (total === 0) {
    return { total: 0, errorCount: 0, avgMs: 0, p95Ms: 0, maxMs: 0, slowest: [], byMethod: [] }
  }

  let sumMs = 0
  let maxMs = 0
  let errorCount = 0
  const methodMap = new Map<string, { count: number; errorCount: number; sumMs: number; maxMs: number }>()

  for (const record of records) {
    sumMs += record.durationMs
    maxMs = Math.max(maxMs, record.durationMs)
    if (record.errorCode !== undefined) errorCount++

    const stats = methodMap.get(record.method) ?? { count: 0, errorCount: 0, sumMs: 0, maxMs: 0 }
    stats.count++
    stats.sumMs += record.durationMs
    stats.maxMs = Math.max(stats.maxMs, record.durationMs)
    if (record.errorCode !== undefined) stats.errorCount++
    methodMap.set(record.method, stats)
  }

  const durations = [...records]
    .map((record) => record.durationMs)
    .sort((a, b) => a - b)
  const p95Index = Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)

  const slowest = [...records].sort((a, b) => b.durationMs - a.durationMs).slice(0, SLOWEST_TO_SHOW)

  const byMethod = [...methodMap.entries()]
    .map(([method, stats]) => ({
      method,
      count: stats.count,
      errorCount: stats.errorCount,
      avgMs: stats.sumMs / stats.count,
      maxMs: stats.maxMs,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    errorCount,
    avgMs: sumMs / total,
    p95Ms: durations[p95Index] ?? 0,
    maxMs,
    slowest,
    byMethod,
  }
}

/** Keep NaN out of the UI when durationMs is somehow non-finite. */
export function safeMs(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}
