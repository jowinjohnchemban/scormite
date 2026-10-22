/**
 * The LMS's persistence for one course session: the last stored attempt of
 * each SCO, keyed by item identifier.
 *
 * Held in memory for the lifetime of the loaded package — switching SCOs or
 * relaunching resumes from here; closing the package discards it.
 */

import type { AttemptRecord } from '@/features/runtime'

export class AttemptStore {
  private readonly records = new Map<string, AttemptRecord>()

  save(itemId: string, record: AttemptRecord): void {
    this.records.set(itemId, record)
  }

  get(itemId: string): AttemptRecord | undefined {
    return this.records.get(itemId)
  }

  has(itemId: string): boolean {
    return this.records.has(itemId)
  }

  discard(itemId: string): void {
    this.records.delete(itemId)
  }

  clear(): void {
    this.records.clear()
  }

  /** Every stored attempt, by item identifier (for persistence). */
  toRecord(): Record<string, AttemptRecord> {
    return Object.fromEntries(this.records)
  }

  /** Replace the stored attempts (restoring saved progress). */
  load(records: Record<string, AttemptRecord>): void {
    this.records.clear()
    for (const [itemId, record] of Object.entries(records)) this.records.set(itemId, record)
  }
}
