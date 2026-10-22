/**
 * Unit tests for launchable-item derivation, item parameters, xml:base
 * resolution, and per-item launch data parsed from the manifest.
 */

import { describe, expect, it } from 'vitest'
import { parseManifest, resolveXmlBase } from '../services/ManifestParserService'
import { applyLaunchParameters, getLaunchableItems } from '../services/launchables'

const MULTI_SCO_12 = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="multi" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="org-b">
    <organization identifier="org-a">
      <title>Unused</title>
      <item identifier="a-1" identifierref="res-1"><title>Wrong org</title></item>
    </organization>
    <organization identifier="org-b">
      <title>Course</title>
      <item identifier="module-1">
        <title>Module 1</title>
        <item identifier="lesson-1" identifierref="res-1" parameters="?page=1">
          <title>Lesson 1</title>
          <adlcp:masteryscore>80</adlcp:masteryscore>
          <adlcp:datafromlms>mode=review</adlcp:datafromlms>
          <adlcp:maxtimeallowed>00:30:00</adlcp:maxtimeallowed>
          <adlcp:timelimitaction>exit,message</adlcp:timelimitaction>
        </item>
        <item identifier="lesson-2" identifierref="res-2"><title>Lesson 2</title></item>
      </item>
      <item identifier="broken" identifierref="res-missing"><title>Broken ref</title></item>
    </organization>
  </organizations>
  <resources xml:base="content/">
    <resource identifier="res-1" type="webcontent" adlcp:scormType="sco" href="one/index.html?lang=en" xml:base="m1">
      <file href="one/index.html"/>
    </resource>
    <resource identifier="res-2" type="webcontent" adlcp:scormtype="sco" href="../two/index.html">
      <file href="../two/index.html"/>
    </resource>
  </resources>
</manifest>`

const SCORM_2004 = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="m2004" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adl="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss">
  <organizations default="org">
    <organization identifier="org">
      <title>Course</title>
      <item identifier="sco-1" identifierref="r1">
        <title>Assessment</title>
        <adl:completionThreshold completedByMeasure="true" minProgressMeasure="0.75"/>
        <adl:dataFromLMS>seed</adl:dataFromLMS>
        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="p" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>0.6</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>
        </imsss:sequencing>
      </item>
      <item identifier="sco-2" identifierref="r1">
        <title>No threshold</title>
        <adl:completionThreshold completedByMeasure="false" minProgressMeasure="0.5"/>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" adl:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`

describe('applyLaunchParameters', () => {
  it('returns the href unchanged without parameters', () => {
    expect(applyLaunchParameters('a.html', undefined)).toBe('a.html')
    expect(applyLaunchParameters('a.html', '  ')).toBe('a.html')
  })

  it('adds a query string, dropping a leading ? or &', () => {
    expect(applyLaunchParameters('a.html', '?x=1')).toBe('a.html?x=1')
    expect(applyLaunchParameters('a.html', '&x=1')).toBe('a.html?x=1')
    expect(applyLaunchParameters('a.html', 'x=1')).toBe('a.html?x=1')
  })

  it('joins onto an existing query string with &', () => {
    expect(applyLaunchParameters('a.html?y=2', '?x=1')).toBe('a.html?y=2&x=1')
  })

  it('appends a fragment only when the href has none', () => {
    expect(applyLaunchParameters('a.html', '#p2')).toBe('a.html#p2')
    expect(applyLaunchParameters('a.html#p1', '#p2')).toBe('a.html#p1')
  })
})

describe('resolveXmlBase', () => {
  it('chains bases as directories and collapses dot segments', () => {
    expect(resolveXmlBase(['content/', 'm1'], 'one/index.html')).toBe('content/m1/one/index.html')
    expect(resolveXmlBase(['content/'], '../two/index.html')).toBe('two/index.html')
    expect(resolveXmlBase([undefined], './index.html')).toBe('index.html')
  })

  it('treats an absolute base as a directory too', () => {
    expect(resolveXmlBase(['https://cdn.example.com/course'], 'index.html')).toBe(
      'https://cdn.example.com/course/index.html',
    )
    expect(resolveXmlBase(['https://cdn.example.com/course', 'sub'], 'a.html')).toBe(
      'https://cdn.example.com/course/sub/a.html',
    )
  })

  it('leaves absolute URLs alone', () => {
    expect(resolveXmlBase(['content/'], 'https://example.com/x.html')).toBe('https://example.com/x.html')
  })

  it('preserves query strings and fragments', () => {
    expect(resolveXmlBase(['a/'], 'b/../c.html?x=../y#z')).toBe('a/c.html?x=../y#z')
  })
})

describe('parseManifest — xml:base and launch data (SCORM 1.2)', () => {
  const manifest = parseManifest(MULTI_SCO_12)

  it('applies xml:base from <resources> and <resource> to href and files', () => {
    const [res1, res2] = manifest.resources
    expect(res1?.href).toBe('content/m1/one/index.html?lang=en')
    expect(res1?.files).toEqual(['content/m1/one/index.html'])
    expect(res2?.href).toBe('two/index.html')
  })

  it('reads scormType regardless of attribute casing', () => {
    expect(manifest.resources.map((r) => r.scormType)).toEqual(['sco', 'sco'])
  })

  it('parses item parameters and 1.2 launch data', () => {
    const lesson = manifest.organizations[1]?.items[0]?.children[0]
    expect(lesson?.parameters).toBe('?page=1')
    expect(lesson?.launchData).toEqual({
      masteryScore: '80',
      dataFromLms: 'mode=review',
      maxTimeAllowed: '00:30:00',
      timeLimitAction: 'exit,message',
    })
  })
})

describe('getLaunchableItems', () => {
  it('walks the default organization in document order, skipping unlaunchable items', () => {
    const items = getLaunchableItems(parseManifest(MULTI_SCO_12))
    expect(items.map((i) => [i.identifier, i.depth, i.launchPath])).toEqual([
      ['lesson-1', 1, 'content/m1/one/index.html?lang=en&page=1'],
      ['lesson-2', 1, 'two/index.html'],
    ])
    expect(items[0]?.launchData.masteryScore).toBe('80')
    expect(items[0]?.scormType).toBe('sco')
  })

  it('falls back to the first organization when no default is declared', () => {
    const manifest = parseManifest(MULTI_SCO_12)
    const items = getLaunchableItems({ ...manifest, defaultOrganizationIdentifier: 'nope' })
    expect(items.map((i) => i.identifier)).toEqual(['a-1'])
  })

  it('returns nothing for a manifest without organizations', () => {
    expect(getLaunchableItems({ organizations: [], resources: [], metadata: {} })).toEqual([])
  })
})

describe('parseManifest — SCORM 2004 launch data under any prefix', () => {
  const items = getLaunchableItems(parseManifest(SCORM_2004))

  it('reads completion threshold, dataFromLMS, and scaled passing score', () => {
    expect(items[0]?.launchData).toEqual({
      dataFromLms: 'seed',
      completionThreshold: '0.75',
      scaledPassingScore: '0.6',
    })
  })

  it('ignores a completion threshold that is not completedByMeasure', () => {
    expect(items[1]?.launchData).toEqual({})
  })
})
