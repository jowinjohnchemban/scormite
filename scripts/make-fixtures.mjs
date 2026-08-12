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
]

await mkdir(outDir, { recursive: true })
for (const pkg of packages) {
  const buffer = await buildZip(pkg.entries)
  await writeFile(join(outDir, pkg.file), buffer)
  console.log(`wrote ${join(outDir, pkg.file)} (${buffer.length} bytes)`)
}
