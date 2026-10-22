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

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'scorm12-multi-sco.zip')

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

test('an agent reads and drives the session through WebMCP tools', async ({ page }) => {
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
    .toBe(10)

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
