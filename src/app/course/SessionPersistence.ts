/**
 * Keeps a course's progress while the page is open, the way an LMS keeps a
 * learner's record: every SCO's stored attempt, per-item progress, the
 * current item, and (SCORM 2004) the sequencing engine's state. Closing a
 * package and opening it again resumes it; reloading the page starts fresh,
 * so a reload is always a clean slate for testing.
 *
 * Kept in memory only — nothing is written to disk or leaves the machine.
 */

import type { AttemptRecord } from '@/features/runtime'
import type { CmiSummary } from './summarizeCmi'

export interface SessionSnapshot {
  /** Bumped when the shape changes; older snapshots are ignored. */
  version: 1
  savedAt: number
  currentItemId: string | null
  attempts: Record<string, AttemptRecord>
  progress: Record<string, CmiSummary>
  /** scorm-again's serialized sequencing state (sequenced courses only). */
  sequencingState?: string
}

/** Minimal async key-value storage behind the persistence. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

/** The IndexedDB database where earlier versions saved progress across reloads. */
const LEGACY_DB_NAME = 'scormite'

/**
 * Delete progress that earlier versions saved across reloads, so none lingers
 * in this browser. Best effort: does nothing where IndexedDB is unavailable.
 */
export function forgetProgressSavedAcrossReloads(): void {
  try {
    globalThis.indexedDB?.deleteDatabase(LEGACY_DB_NAME)
  } catch {
    // Blocked storage: there is nothing saved to forget.
  }
}

/** In-memory store: what it holds lasts as long as the page. */
export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, unknown>()
  get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.get(key))
  }
  set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value))
    return Promise.resolve()
  }
  delete(key: string): Promise<void> {
    this.values.delete(key)
    return Promise.resolve()
  }
}

function isSnapshot(value: unknown): value is SessionSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { attempts?: unknown }).attempts === 'object'
  )
}

/**
 * Identity of a package across reloads: a hash of its manifest plus the
 * archive size — the same zip re-opened maps to the same saved progress; a
 * changed package does not inherit progress made against another version.
 */
export async function packageKey(manifestXml: string, archiveSize: number): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(manifestXml))
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex}:${archiveSize}`
}

export class SessionPersistence {
  private readonly store: KeyValueStore
  private readonly key: string
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: SessionSnapshot | null = null

  constructor(store: KeyValueStore, key: string) {
    this.store = store
    this.key = key
  }

  async load(): Promise<SessionSnapshot | null> {
    try {
      const value = await this.store.get(this.key)
      return isSnapshot(value) ? value : null
    } catch {
      return null
    }
  }

  /** Save soon, coalescing bursts of calls (a SCO committing in a loop). */
  saveSoon(snapshot: SessionSnapshot, delayMs = 150): void {
    this.pending = snapshot
    if (this.timer !== null) return
    this.timer = setTimeout(() => void this.flush(), delayMs)
  }

  /** Write any pending snapshot now. */
  async flush(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    const snapshot = this.pending
    this.pending = null
    if (!snapshot) return
    try {
      await this.store.set(this.key, snapshot)
    } catch {
      // Storage full or blocked: progress simply is not kept.
    }
  }

  /** Forget the saved progress (Restart whole course). */
  async clear(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
    try {
      await this.store.delete(this.key)
    } catch {
      // Nothing to forget.
    }
  }
}
