/**
 * Keeps a course's progress across page reloads, the way an LMS keeps a
 * learner's record: every SCO's stored attempt, per-item progress, the
 * current item, and (SCORM 2004) the sequencing engine's state.
 *
 * Saved in this browser only (IndexedDB) — nothing leaves the machine. When
 * IndexedDB is unavailable (private browsing, blocked storage), saving
 * quietly does nothing and every open starts fresh.
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

/** Minimal async key-value storage, so persistence can be tested without IndexedDB. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

const DB_NAME = 'scormite'
const STORE = 'course-sessions'

/** IndexedDB-backed store; every method degrades to a no-op when IndexedDB is unavailable. */
export class IndexedDbStore implements KeyValueStore {
  private db: Promise<IDBDatabase | null> | null = null

  private open(): Promise<IDBDatabase | null> {
    this.db ??= new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      try {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(STORE)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return this.db
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await this.open()
    if (!db) return undefined
    return new Promise((resolve) => {
      try {
        const request = action(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(undefined)
      } catch {
        resolve(undefined)
      }
    })
  }

  async get(key: string): Promise<unknown> {
    return this.run('readonly', (store) => store.get(key))
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.run('readwrite', (store) => store.put(value, key))
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(key))
  }
}

/** In-memory store, for tests and as an explicit "do not persist" choice. */
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
