/**
 * Progress kept across reloads for 24 hours: the persistence store itself,
 * its expiry, and full reload round trips through CourseSession with the real
 * runtime / engine.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getActivityTree, getLaunchableItems, parseManifest } from '@/features/manifest'
import { useRuntimeStore, type Scorm2004Adapter } from '@/features/runtime'
import { useValidationStore } from '@/features/validation'
import type { Package } from '@/shared/types'
import { useCourseStore } from '@/app/state/courseStore'
import { CourseSession } from './CourseSession'
import {
  deleteExpiredProgress,
  MemoryStore,
  packageKey,
  PROGRESS_TTL_MS,
  SessionPersistence,
  type SessionSnapshot,
} from './SessionPersistence'

const snapshot = (savedAt: number): SessionSnapshot => ({
  version: 1,
  savedAt,
  currentItemId: 'a',
  attempts: {},
  progress: {},
})

describe('SessionPersistence', () => {
  it('coalesces saves and writes the latest on flush', async () => {
    const store = new MemoryStore()
    const persistence = new SessionPersistence(store, 'k', () => 10)
    persistence.saveSoon(snapshot(1), 10_000)
    persistence.saveSoon(snapshot(2), 10_000)
    expect(await persistence.load()).toBeNull()
    await persistence.flush()
    expect((await persistence.load())?.savedAt).toBe(2)
  })

  it('ignores stored values that are not a current snapshot, and clears', async () => {
    const store = new MemoryStore()
    await store.set('k', { version: 0, attempts: {} })
    const persistence = new SessionPersistence(store, 'k', () => 10)
    expect(await persistence.load()).toBeNull()
    persistence.saveSoon(snapshot(3), 10_000)
    await persistence.flush()
    await persistence.clear()
    expect(await persistence.load()).toBeNull()
  })

  it('treats progress not saved again within 24 hours as invalid, and deletes it', async () => {
    const store = new MemoryStore()
    await store.set('k', snapshot(0))
    expect(await new SessionPersistence(store, 'k', () => PROGRESS_TTL_MS - 1).load()).not.toBeNull()
    expect(await new SessionPersistence(store, 'k', () => PROGRESS_TTL_MS).load()).toBeNull()
    expect(await store.keys()).toEqual([])
  })

  it('deletes every expired or unreadable progress at start-up, and keeps the rest', async () => {
    const store = new MemoryStore()
    const now = 3 * PROGRESS_TTL_MS
    await store.set('old', snapshot(now - PROGRESS_TTL_MS - 1))
    await store.set('broken', { version: 0 })
    await store.set('recent', snapshot(now - 60_000))
    expect(await deleteExpiredProgress(store, now)).toBe(2)
    expect(await store.keys()).toEqual(['recent'])
  })

  it('keys a package by its manifest and archive size', async () => {
    expect(await packageKey('<manifest/>', 10)).toBe(await packageKey('<manifest/>', 10))
    expect(await packageKey('<manifest/>', 10)).not.toBe(await packageKey('<manifest/>', 11))
    expect(await packageKey('<manifest/>', 10)).not.toBe(await packageKey('<manifest a="1"/>', 10))
  })
})

function manifestXml(version: '1.2' | '2004'): string {
  return `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schema>ADL SCORM</schema><schemaversion>${version === '1.2' ? '1.2' : '2004 4th Edition'}</schemaversion></metadata>
  <organizations default="org"><organization identifier="org"><title>Course</title>
    ${['a', 'b', 'c'].map((id) => `<item identifier="${id}" identifierref="r-${id}"><title>${id}</title></item>`).join('')}
  </organization></organizations>
  <resources>${['a', 'b', 'c'].map((id) => `<resource identifier="r-${id}" type="webcontent" adlcp:scormType="sco" href="${id}.html"/>`).join('')}</resources>
</manifest>`
}

function newSession(
  version: '1.2' | '2004',
  persistence: SessionPersistence,
  saved: SessionSnapshot | null,
): CourseSession {
  const manifest = parseManifest(manifestXml(version))
  const items = getLaunchableItems(manifest)
  const pkg: Package = {
    id: `pkg-${version}`,
    name: 'p',
    sourceType: 'zip',
    scormVersion: version,
    manifest,
    launchUrl: 'a.html',
    loadedAt: new Date(),
  }
  const tree = getActivityTree(manifest)
  return new CourseSession(pkg, items, version === '2004' && tree ? { activityTree: tree } : null, persistence, saved)
}

function settle(session: CourseSession): void {
  const pending = useCourseStore.getState().pendingLaunch
  if (pending) session.deliver(pending)
}

const sessions: CourseSession[] = []
beforeEach(() => {
  useCourseStore.getState().reset()
  useRuntimeStore.getState().reset()
  useValidationStore.getState().reset()
})
afterEach(() => {
  for (const session of sessions.splice(0)) session.dispose()
})

describe('reopening a course', () => {
  it('resumes the item the learner was on, with its suspended data (SCORM 1.2)', async () => {
    const persistence = new SessionPersistence(new MemoryStore(), 'k')
    const first = newSession('1.2', persistence, null)
    sessions.push(first)
    first.start()
    settle(first)
    useCourseStore.getState().requestLaunch('b')
    settle(first)
    const adapter = useRuntimeStore.getState().adapter
    adapter?.initialize()
    adapter?.setValue('cmi.core.lesson_location', 'page-7')
    adapter?.setValue('cmi.core.exit', 'suspend')
    adapter?.commit()
    first.persist()
    await first.flushSaves()

    // A reload: a new session from what was saved.
    useCourseStore.getState().reset()
    useRuntimeStore.getState().reset()
    const second = newSession('1.2', persistence, await persistence.load())
    sessions.push(second)
    second.start()
    expect(useCourseStore.getState().pendingLaunch).toEqual({ itemId: 'b', mode: 'resume' })
    expect(useCourseStore.getState()).toMatchObject({
      notice: expect.stringMatching(/Resumed the progress saved on .* cleared 24 hours/),
      noticeAction: 'clear-progress',
    })
    settle(second)
    const resumed = useRuntimeStore.getState().adapter
    resumed?.initialize()
    expect(resumed?.getValue('cmi.core.lesson_location')).toBe('page-7')
    expect(resumed?.getValue('cmi.core.entry')).toBe('resume')
  })

  it("resumes a sequenced course with the engine's rollup intact (SCORM 2004)", async () => {
    const persistence = new SessionPersistence(new MemoryStore(), 'k')
    const first = newSession('2004', persistence, null)
    sessions.push(first)
    first.start()
    settle(first)
    const engine = useRuntimeStore.getState().adapter
    engine?.initialize()
    engine?.setValue('cmi.completion_status', 'completed')
    engine?.setValue('adl.nav.request', 'continue')
    engine?.terminate()
    settle(first)
    expect(useCourseStore.getState().currentItemId).toBe('b')
    await first.flushSaves()

    useCourseStore.getState().reset()
    useRuntimeStore.getState().reset()
    const second = newSession('2004', persistence, await persistence.load())
    sessions.push(second)
    second.start()
    expect(useCourseStore.getState().pendingLaunch?.itemId).toBe('b')
    settle(second)
    const restored = useRuntimeStore.getState().adapter as Scorm2004Adapter | null
    expect(restored?.activityStatus('a')?.completionStatus).toBe('completed')
  })

  it('forgets saved progress when the course is restarted', async () => {
    const persistence = new SessionPersistence(new MemoryStore(), 'k')
    const session = newSession('1.2', persistence, null)
    sessions.push(session)
    session.start()
    settle(session)
    await session.flushSaves()
    expect(await persistence.load()).not.toBeNull()
    useCourseStore.getState().setNotice('Resumed the progress saved earlier.', 'info', 'clear-progress')
    session.restart()
    await Promise.resolve()
    expect(await persistence.load()).toBeNull()
    expect(useCourseStore.getState()).toMatchObject({ notice: null, noticeAction: null })
  })
})
