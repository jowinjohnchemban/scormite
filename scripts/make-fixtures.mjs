/**
 * Generates the committed Playwright e2e fixture packages.
 *
 * The generated zips in `e2e/fixtures/` are checked in so CI never needs to
 * run this script (or touch the network). Regenerate with:
 *
 *   node scripts/make-fixtures.mjs
 *
 * Each fixture is a minimal, spec-correct SCORM package whose SCO talks to
 * the runtime through the standard API surface (window.parent.API for 1.2,
 * window.parent.API_1484_11 for 2004) and writes its results into the
 * document body so e2e specs can assert the full pipeline: unzip → manifest
 * parse → SW caching → iframe launch → API proxy → scorm-again adapter →
 * CMI state.
 *
 * File dates are pinned to a fixed instant so the zips are byte-stable and
 * regenerating them produces no diff.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z')

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures')

const SCO_12 = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>E2E SCO (SCORM 1.2)</title>
</head>
<body>
<script>
  (function () {
    var api = window.parent.API
    var log = []
    try {
      log.push('init=' + api.LMSInitialize(''))
      log.push('set=' + api.LMSSetValue('cmi.core.lesson_status', 'completed'))
      log.push('setScore=' + api.LMSSetValue('cmi.core.score.raw', '100'))
      log.push('commit=' + api.LMSCommit(''))
      log.push('get=' + api.LMSGetValue('cmi.core.lesson_status'))
      log.push('finish=' + api.LMSFinish(''))
    } catch (e) {
      log.push('error=' + (e && e.message))
    }
    document.body.textContent = log.join(' | ')
  })()
</script>
</body>
</html>
`

const SCO_2004 = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>E2E SCO (SCORM 2004)</title>
</head>
<body>
<script>
  (function () {
    var api = window.parent.API_1484_11
    var log = []
    try {
      log.push('init=' + api.Initialize(''))
      log.push('setStatus=' + api.SetValue('cmi.completion_status', 'completed'))
      log.push('setSuccess=' + api.SetValue('cmi.success_status', 'passed'))
      log.push('setScore=' + api.SetValue('cmi.score.scaled', '1'))
      log.push('commit=' + api.Commit(''))
      log.push('get=' + api.GetValue('cmi.completion_status'))
      log.push('term=' + api.Terminate(''))
    } catch (e) {
      log.push('error=' + (e && e.message))
    }
    document.body.textContent = log.join(' | ')
  })()
</script>
</body>
</html>
`

const MANIFEST_12 = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="e2e-scorm12"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  version="1.2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-e2e-12">
    <organization identifier="org-e2e-12">
      <title>E2E Org 1.2</title>
      <item identifier="item-e2e-12-1" identifierref="res-e2e-12-1">
        <title>E2E SCO 1.2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-e2e-12-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`

const MANIFEST_2004 = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="e2e-scorm2004"
  xmlns="http://www.imsglobal.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org-e2e-2004">
    <organization identifier="org-e2e-2004">
      <title>E2E Org 2004</title>
      <item identifier="item-e2e-2004-1" identifierref="res-e2e-2004-1">
        <title>E2E SCO 2004</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-e2e-2004-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`

// ---------------------------------------------------------------------------
// Multi-SCO SCORM 1.2: outline navigation, manifest launch data, item
// parameters, resume (entry=resume + suspend_data) and mastery scoring.
// ---------------------------------------------------------------------------

/** Each SCO prints what the LMS gave it, then records progress and suspends. */
function multiSco12(name, score) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>${name}</title></head>
<body>
<script>
  (function () {
    var api = window.parent.API
    api.LMSInitialize('')
    var out = [
      '${name}',
      'entry=' + api.LMSGetValue('cmi.core.entry'),
      'suspend=' + api.LMSGetValue('cmi.suspend_data'),
      'launch_data=' + api.LMSGetValue('cmi.launch_data'),
      'mastery=' + api.LMSGetValue('cmi.student_data.mastery_score'),
      'query=' + location.search
    ]
    api.LMSSetValue('cmi.suspend_data', '${name}-state')
    api.LMSSetValue('cmi.core.lesson_location', 'page-2')
    api.LMSSetValue('cmi.core.score.raw', '${score}')
    api.LMSSetValue('cmi.core.exit', 'suspend')
    api.LMSCommit('')
    document.body.textContent = out.join(' | ')
  })()
</script>
</body>
</html>
`
}

const MANIFEST_12_MULTI = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="e2e-scorm12-multi"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  version="1.2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-multi">
    <organization identifier="org-multi">
      <title>Multi SCO Course</title>
      <item identifier="module-1">
        <title>Module 1</title>
        <item identifier="lesson-1" identifierref="res-lesson-1" parameters="?mode=test">
          <title>Lesson One</title>
          <adlcp:datafromlms>from-manifest</adlcp:datafromlms>
          <adlcp:masteryscore>70</adlcp:masteryscore>
        </item>
        <item identifier="lesson-2" identifierref="res-lesson-2">
          <title>Lesson Two</title>
          <adlcp:masteryscore>70</adlcp:masteryscore>
        </item>
      </item>
    </organization>
  </organizations>
  <resources xml:base="lessons/">
    <resource identifier="res-lesson-1" type="webcontent" adlcp:scormtype="sco" href="one.html">
      <file href="one.html"/>
    </resource>
    <resource identifier="res-lesson-2" type="webcontent" adlcp:scormtype="sco" href="two.html">
      <file href="two.html"/>
    </resource>
  </resources>
</manifest>
`

// ---------------------------------------------------------------------------
// Two-SCO SCORM 2004: the first SCO asks for adl.nav.request=continue, so
// the player must deliver the second SCO on its own.
// ---------------------------------------------------------------------------

const SCO_2004_FIRST = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>Intro</title></head>
<body>
<script>
  (function () {
    var api = window.parent.API_1484_11
    api.Initialize('')
    api.SetValue('cmi.completion_status', 'completed')
    api.SetValue('adl.nav.request', 'continue')
    document.body.textContent = 'intro done'
    api.Terminate('')
  })()
</script>
</body>
</html>
`

const SCO_2004_SECOND = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>Quiz</title></head>
<body>
<script>
  (function () {
    var api = window.parent.API_1484_11
    api.Initialize('')
    api.SetValue('cmi.score.scaled', '0.9')
    api.SetValue('cmi.success_status', 'passed')
    api.SetValue('cmi.completion_status', 'completed')
    api.Commit('')
    document.body.textContent = 'quiz delivered | threshold=' + api.GetValue('cmi.completion_threshold')
  })()
</script>
</body>
</html>
`

const MANIFEST_2004_SEQUENCED = `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="e2e-scorm2004-flow"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 3rd Edition</schemaversion>
  </metadata>
  <organizations default="org-flow">
    <organization identifier="org-flow">
      <title>Flow Course</title>
      <item identifier="intro" identifierref="res-intro"><title>Intro</title></item>
      <item identifier="quiz" identifierref="res-quiz">
        <title>Quiz</title>
        <adlcp:completionThreshold>0.8</adlcp:completionThreshold>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-intro" type="webcontent" adlcp:scormType="sco" href="intro.html">
      <file href="intro.html"/>
    </resource>
    <resource identifier="res-quiz" type="webcontent" adlcp:scormType="sco" href="quiz.html">
      <file href="quiz.html"/>
    </resource>
  </resources>
</manifest>
`

/** Pin file metadata so regenerated zips are byte-identical. */
function pinned(name, content) {
  return { name, content, date: FIXED_DATE }
}

async function buildZip(entries) {
  const zip = new JSZip()
  for (const { name, content, date } of entries) {
    zip.file(name, content, { date })
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    platform: 'UNIX',
  })
}

const packages = [
  { file: 'scorm12-basic.zip', entries: [pinned('imsmanifest.xml', MANIFEST_12), pinned('index.html', SCO_12)] },
  { file: 'scorm2004-basic.zip', entries: [pinned('imsmanifest.xml', MANIFEST_2004), pinned('index.html', SCO_2004)] },
  {
    file: 'scorm12-multi-sco.zip',
    entries: [
      pinned('imsmanifest.xml', MANIFEST_12_MULTI),
      pinned('lessons/one.html', multiSco12('lesson-one', 85)),
      pinned('lessons/two.html', multiSco12('lesson-two', 40)),
    ],
  },
  {
    file: 'scorm2004-flow.zip',
    entries: [
      pinned('imsmanifest.xml', MANIFEST_2004_SEQUENCED),
      pinned('intro.html', SCO_2004_FIRST),
      pinned('quiz.html', SCO_2004_SECOND),
    ],
  },
  {
    // The single most common packaging mistake: zipping the course folder.
    file: 'scorm12-folder-wrapped.zip',
    entries: [
      pinned('Wrapped Course/imsmanifest.xml', MANIFEST_12),
      pinned('Wrapped Course/index.html', SCO_12),
    ],
  },
]

await mkdir(outDir, { recursive: true })
for (const pkg of packages) {
  const buffer = await buildZip(pkg.entries)
  await writeFile(join(outDir, pkg.file), buffer)
  console.log(`wrote ${join(outDir, pkg.file)} (${buffer.length} bytes)`)
}
