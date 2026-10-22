/**
 * WCAG 2.1 AA audit in a real browser. Unlike the jsdom audit
 * (src/app/a11y.test.tsx), this one sees real layout and colours, so it also
 * covers colour contrast. Every key state must have zero violations.
 */

import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const axeSource = readFileSync(path.join(root, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
const fixture = (name: string) => path.join(root, 'e2e', 'fixtures', name)

async function violations(page: Page): Promise<string[]> {
  // Park the pointer so the audit never depends on which element the last
  // click left hovered. Text on hover backgrounds is kept at slate-500 or
  // lighter instead (see docs/architecture.md#accessibility).
  await page.mouse.move(0, 0)
  // The loading screen fades out once the app starts; mid-fade its text is
  // partly transparent, so audit only after it has gone.
  await expect(page.locator('#preloader')).toHaveCount(0)
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    // Runs in the page; the e2e tsconfig has no DOM types, so type what is used.
    const page = globalThis as unknown as {
      document: unknown
      axe: {
        run: (
          context: unknown,
          options: object,
        ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>
      }
    }
    const result = await page.axe.run(page.document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
}

test('the start page meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Drop a SCORM package here/i })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('the about page meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.getByRole('heading', { name: 'About SCORMite', level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: 'SCORMite architecture' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('a running sequenced course meets WCAG 2.1 AA in both modes and on a phone', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm2004-sequenced.zip'))
  await page.frameLocator('iframe[title="SCORM Package"]').getByRole('button', { name: 'Pass and continue' }).waitFor()
  expect(await violations(page), 'Basic mode').toEqual([])

  await page.getByRole('button', { name: /^Learner/ }).click()
  expect(await violations(page), 'Learner popover').toEqual([])
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await page.getByRole('button', { name: 'Panels' }).click()
  for (const name of ['Files', 'Network', 'Validation', 'CMI History', 'Breakpoints']) {
    const item = page.getByRole('menuitemcheckbox', { name })
    if ((await item.getAttribute('aria-checked')) === 'false') await item.click()
  }
  await page.keyboard.press('Escape')
  expect(await violations(page), 'Advanced mode, all panels').toEqual([])

  await page.getByRole('button', { name: 'Basic', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 800 })
  expect(await violations(page), 'phone, Course tab').toEqual([])
  await page.getByRole('tab', { name: /^Log/ }).click()
  expect(await violations(page), 'phone, Log tab').toEqual([])
})
