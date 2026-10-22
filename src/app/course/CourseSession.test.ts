/**
 * CourseSession against the real runtime and sequencing engine: launches,
 * competing navigation requests, restarts, and held breakpoint calls.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getActivityTree, getLaunchableItems, parseManifest } from '@/features/manifest'
import { useRuntimeStore } from '@/features/runtime'
import { useBreakpointStore } from '@/features/session'
import { useValidationStore } from '@/features/validation'
import type { Package } from '@/shared/types'
import { useCourseStore } from '@/app/state/courseStore'
import { CourseSession } from './CourseSession'

function manifestXml(version: '1.2' | '2004', extraOrgSequencing = ''): string {
  const ns =
    version === '1.2'
      ? 'xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"'
      : 'xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3" xmlns:imsss="http://www.imsglobal.org/xsd/imsss"'
  const items = ['a', 'b', 'c']
  return `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" ${ns}>
  <metadata><schema>ADL SCORM</schema><schemaversion>${version === '1.2' ? '1.2' : '2004 4th Edition'}</schemaversion></metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>Course</title>
      ${items.map((id) => `<item identifier="${id}" identifierref="r-${id}"><title>${id.toUpperCase()}</title></item>`).join('')}
      ${extraOrgSequencing}
    </organization>
  </organizations>
  <resources>
    ${items.map((id) => `<resource identifier="r-${id}" type="webcontent" adlcp:scormType="sco" adlcp:scormtype="sco" href="${id}.html"/>`).join('')}
  </resources>
</manifest>`
}

function sessionFor(version: '1.2' | '2004', extraOrgSequencing = ''): CourseSession {
  const manifest = parseManifest(manifestXml(version, extraOrgSequencing))
  const items = getLaunchableItems(manifest)
  const pkg: Package = {
    id: `pkg-${version}`,
    name: 'test',
    sourceType: 'zip',
    scormVersion: version,
    manifest,
    launchUrl: items[0]?.launchPath ?? '',
    loadedAt: new Date(),
  }
  const tree = getActivityTree(manifest)
  return new CourseSession(pkg, items, version === '2004' && tree ? { activityTree: tree } : null)
}

/** Run what usePackageSession's effects do: perform the pending launch. */
function settle(session: CourseSession): void {
  const pending = useCourseStore.getState().pendingLaunch
  if (pending) session.deliver(pending)
}

let session: CourseSession | null = null

beforeEach(() => {
  useCourseStore.getState().reset()
  useRuntimeStore.getState().reset()
  useValidationStore.getState().reset()
  useBreakpointStore.getState().reset()
})

afterEach(() => {
  session?.dispose()
  session = null
})

describe('CourseSession — flow mode (SCORM 1.2)', () => {
  it('starts on the first item', () => {
    session = sessionFor('1.2')
    session.start()
    settle(session)
    expect(useCourseStore.getState().currentItemId).toBe('a')
  })

  it("keeps the learner's choice when the unloading SCO also asks to move", () => {
    // A 2004 package in flow mode (no engine), so the SCO's request goes
    // through CourseNavigator.
    const manifest = parseManifest(manifestXml('2004'))
    const items = getLaunchableItems(manifest)
    session = new CourseSession(
      {
        id: 'pkg-flow',
        name: 'flow',
        sourceType: 'zip',
        scormVersion: '2004',
        manifest,
        launchUrl: 'a.html',
        loadedAt: new Date(),
      },
      items,
      null,
    )
    session.start()
    settle(session)

    useCourseStore.getState().go({ request: 'choice', targetId: 'c', mode: 'resume' })
    // The SCO being unloaded terminates with its own continue request.
    const adapter = useRuntimeStore.getState().adapter
    adapter?.initialize()
    adapter?.setValue('adl.nav.request', 'continue')
    adapter?.terminate()

    expect(useCourseStore.getState().pendingLaunch?.itemId).toBe('c')
  })
})

describe('CourseSession — sequenced (SCORM 2004)', () => {
  it('lets a SCO-requested delivery replace a pending relative learner request', () => {
    session = sessionFor('2004')
    session.start()
    settle(session)
    expect(useCourseStore.getState().currentItemId).toBe('a')

    useCourseStore.getState().go({ request: 'continue', mode: 'resume' })
    expect(useCourseStore.getState().pendingNavigation).not.toBeNull()

    // Before the learner's request runs, SCO "a" terminates asking to continue.
    const adapter = useRuntimeStore.getState().adapter
    adapter?.initialize()
    adapter?.setValue('adl.nav.request', 'continue')
    adapter?.terminate()

    const course = useCourseStore.getState()
    expect(course.pendingNavigation).toBeNull()
    expect(course.pendingLaunch?.itemId).toBe('b')
  })

  it('does not duplicate sequencing warnings when the course restarts', () => {
    const unsupported = `<imsss:sequencing><imsss:rollupRules><imsss:rollupRule childActivitySet="all">
      <imsss:rollupConditions><imsss:rollupCondition condition="timeLimitExceeded"/></imsss:rollupConditions>
      <imsss:rollupAction action="notSatisfied"/></imsss:rollupRule></imsss:rollupRules></imsss:sequencing>`
    session = sessionFor('2004', unsupported)
    const count = () => useValidationStore.getState().issues.filter((i) => i.ruleId === 'sequencing.unsupported').length
    session.start()
    settle(session)
    expect(count()).toBe(1)
    session.restart()
    settle(session)
    session.restart()
    settle(session)
    expect(count()).toBe(1)
  })

  it("discards a held breakpoint call instead of applying it to the next SCO's runtime", () => {
    session = sessionFor('2004')
    session.start()
    settle(session)
    useBreakpointStore.getState().addBreakpoint({ kind: 'cmi-set', element: 'cmi.location' })
    const adapter = useRuntimeStore.getState().adapter
    adapter?.initialize()
    adapter?.setValue('cmi.location', 'from-a')
    expect(adapter?.isPaused).toBe(true)

    useCourseStore.getState().requestLaunch('b')
    settle(session)
    expect(adapter?.isPaused).toBe(false)
    useBreakpointStore.getState().resume()
    expect(useRuntimeStore.getState().adapter?.getFlattenedCmi()['cmi.location']).toBe('')
  })
})
