/**
 * End-to-end: WebMCP. An agent in the browser reads and drives the open
 * session through the tools SCORMite registers on `document.modelContext`.
 *
 * Playwright's Chromium does not ship WebMCP, so a minimal stand-in model
 * context is installed before the app loads; it records what SCORMite
 * registers and lets the test call the tools as an agent would.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture = path.join(fixtures, 'scorm12-multi-sco.zip')
const TOOL_COUNT = 34

/** Call a registered tool as an agent would; the result comes back JSON-serialized. */
async function callTool(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const json = await page.evaluate(
    async ([toolName, toolInput]) => {
      type Tool = { execute: (input: unknown, options: { signal: AbortSignal }) => Promise<unknown> }
      const registry = (globalThis as unknown as { __webmcpTools: Map<string, Tool> }).__webmcpTools
      const tool = registry.get(toolName as string)
      if (!tool) throw new Error(`tool ${String(toolName)} is not registered`)
      return JSON.stringify(await tool.execute(toolInput, { signal: new AbortController().signal }))
    },
    [name, input] as const,
  )
  return JSON.parse(json) as Record<string, unknown>
}

/** Install a stand-in model context, open SCORMite, and wait for its tools. */
async function openWithModelContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tools = new Map<string, unknown>()
    ;(globalThis as unknown as { __webmcpTools: Map<string, unknown> }).__webmcpTools = tools
    // The e2e tsconfig has no DOM types; this runs in the page.
    const doc = (globalThis as unknown as { document: object }).document
    Object.defineProperty(doc, 'modelContext', {
      value: {
        registerTool: async (tool: { name: string }, options?: { signal?: AbortSignal }) => {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => tools.delete(tool.name))
        },
      },
    })
  })
  await page.goto('/')
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as unknown as { __webmcpTools: Map<string, unknown> }).__webmcpTools.size),
    )
    .toBe(TOOL_COUNT)
}

test('an agent reads and drives the session through WebMCP tools', async ({ page }) => {
  await openWithModelContext(page)

  // Before a package is open the agent is told what to do.
  expect(await callTool(page, 'get_cmi')).toMatchObject({ error: expect.stringMatching(/No package is open/) })

  await page.setInputFiles('input[type="file"]', fixture)
  const player = page.frameLocator('iframe[title="SCORM Package"]').locator('body')
  await expect(player).toContainText('lesson-one', { timeout: 15_000 })

  const session = await callTool(page, 'get_session')
  expect(session).toMatchObject({ open: true, package: { scormVersion: '1.2' }, navigation: { canNext: true } })
  const items = session['items'] as { id: string; current: boolean }[]
  expect(items).toHaveLength(2)
  expect(items[0]?.current).toBe(true)

  // Navigate as the Next button would; the second SCO runs.
  expect(await callTool(page, 'navigate', { direction: 'next' })).toMatchObject({ requested: true })
  await expect(player).toContainText('lesson-two')
  await expect.poll(async () => (await callTool(page, 'get_session'))['currentItemId']).toBe(items[1]?.id)

  // The running SCO's data and the API log are readable.
  const cmi = await callTool(page, 'get_cmi', { prefix: 'cmi.core.lesson' })
  expect(Object.keys(cmi['elements'] as object)).toContain('cmi.core.lesson_status')
  const log = await callTool(page, 'get_api_log', { limit: 5 })
  expect((log['calls'] as unknown[]).length).toBeGreaterThan(0)

  // Switching to Advanced mode leaves the course running.
  expect(await callTool(page, 'set_view_mode', { mode: 'advanced' })).toEqual({ mode: 'advanced' })
  await expect(page.locator('[data-testid="dock-region-left"]')).toBeVisible()
  await expect(player).toContainText('lesson-two')

  const report = await callTool(page, 'get_report')
  expect(report).toMatchObject({ format: 'markdown', report: expect.stringContaining('scorm12-multi-sco') })
})

test('an agent plans, takes, and audits a sequenced course', async ({ page }) => {
  await openWithModelContext(page)
  await page.setInputFiles('input[type="file"]', path.join(fixtures, 'scorm2004-sequenced.zip'))
  const player = page.frameLocator('iframe[title="SCORM Package"]').locator('body')
  await expect(player.getByRole('button', { name: 'Pass and continue' })).toBeVisible({ timeout: 15_000 })

  // A plan for this package, including its sequencing.
  const plan = await callTool(page, 'get_test_plan')
  const goals = (plan['steps'] as { goal: string }[]).map((step) => step.goal)
  expect(goals).toContain('Check the sequencing rules.')

  // The package's structure and files.
  const files = await callTool(page, 'list_files')
  expect(files['files']).toContainEqual({ path: 'imsmanifest.xml' })
  const manifest = await callTool(page, 'read_file', { path: 'imsmanifest.xml' })
  expect(manifest['text']).toEqual(expect.stringContaining('<manifest'))

  // Read the running page and complete it like a learner.
  const pageBefore = await callTool(page, 'read_sco_page')
  const controls = pageBefore['controls'] as { ref: string; name: string }[]
  const pass = controls.find((control) => control.name === 'Pass and continue')
  expect(pass).toBeDefined()
  expect(await callTool(page, 'interact_with_sco', { ref: pass?.ref, action: 'click' })).toMatchObject({ done: true })

  // The sequencing engine delivers the gated quiz.
  await expect(player).toContainText('gated quiz delivered', { timeout: 15_000 })

  // The audit sees one item passed and nothing wrong.
  await expect
    .poll(async () => ((await callTool(page, 'audit_session'))['coverage'] as { passed: number }).passed)
    .toBe(1)
  const audit = await callTool(page, 'audit_session')
  expect(audit['summary']).toMatchObject({ error: 0 })
})

test('an agent reviews the content, scans the package, and scripts the course', async ({ page }) => {
  await openWithModelContext(page)
  await page.setInputFiles('input[type="file"]', fixture)
  const player = page.frameLocator('iframe[title="SCORM Package"]').locator('body')
  await expect(player).toContainText('lesson-one', { timeout: 15_000 })

  // The whole package's text and references, without launching anything.
  const text = await callTool(page, 'extract_course_text')
  expect(text['files']).toContainEqual(expect.objectContaining({ path: 'lessons/two.html', title: 'lesson-two' }))
  const references = await callTool(page, 'check_references')
  expect(references).toMatchObject({ broken: [], external: [] })
  const search = await callTool(page, 'search_package', { query: 'cmi.core.lesson_location' })
  expect((search['matches'] as { file: string }[]).map((match) => match.file)).toContain('lessons/one.html')

  // A clean package scans clean, and its files can be hashed.
  const scan = await callTool(page, 'scan_package_security')
  expect(scan).toMatchObject({ scannedFiles: 3, summary: { error: 0, warning: 0, info: 0 } })
  const hashes = await callTool(page, 'get_file_hashes', { paths: ['imsmanifest.xml'] })
  expect(hashes['files']).toEqual([expect.objectContaining({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/) })])

  // Script the running SCO and call its API directly.
  expect(await callTool(page, 'run_script_in_sco', { script: 'return document.title' })).toEqual({
    result: 'lesson-one',
  })
  expect(
    await callTool(page, 'call_scorm_api', { method: 'SetValue', element: 'cmi.core.lesson_status', value: 'passed' }),
  ).toMatchObject({ method: 'LMSSetValue', result: 'true', errorCode: '0' })
  expect(
    await callTool(page, 'wait_for', { element: 'cmi.core.lesson_status', value: 'passed', timeoutMs: 5000 }),
  ).toMatchObject({ met: true })

  // A finding the review records shows in the validation issues and the report.
  expect(
    await callTool(page, 'add_review_finding', {
      severity: 'warning',
      category: 'wording',
      message: 'The page shows raw CMI values to the learner.',
      location: 'lessons/one.html',
    }),
  ).toEqual({ recorded: true, reviewFindings: 1 })
  const issues = await callTool(page, 'get_validation_issues')
  expect(JSON.stringify(issues)).toContain('review.wording')
  const report = await callTool(page, 'get_report')
  expect(report['report']).toEqual(expect.stringContaining('The page shows raw CMI values to the learner.'))
  expect(await callTool(page, 'clear_review_findings')).toEqual({ removed: 1 })
})
