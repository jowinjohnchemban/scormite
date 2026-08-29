/**
 * End-to-end: loading a SCORM 2004 4th Edition package. Verifies the
 * edition-specific sidebar text and that the SCO's API calls (via
 * `window.parent.API_1484_11`) surface in the CMI summary.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const packageZip = path.join(fixturesDir, 'scorm2004-basic.zip')

test('loads a SCORM 2004 4th Edition package and runs the SCO end to end', async ({ page }) => {
  await page.goto('/')

  await page.setInputFiles('input[type="file"]', packageZip)

  // Sidebar shows the edition.
  await expect(page.getByText('scorm2004-basic', { exact: true })).toBeVisible()
  await expect(page.getByText('SCORM 2004 4th Edition', { exact: true })).toBeVisible()

  // Manifest tree renders the 2004 org + item.
  await expect(page.getByRole('button', { name: /E2E Org 2004/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /E2E SCO 2004/i })).toBeVisible()

  const player = page.frameLocator('iframe[title="SCORM Package"]')
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute(
    'src',
    /\/scorm-files\//,
    { timeout: 15_000 },
  )

  // The 2004 SCO ran against API_1484_11.
  await expect(player.locator('body')).toContainText('init=', { timeout: 15_000 })

  // CMI summary: completion_status completed, success_status passed.
  const statusRow = page.getByText('Status', { exact: true }).locator('..')
  await expect(statusRow).toContainText('completed', { timeout: 15_000 })
  const successRow = page.getByText('Success', { exact: true }).locator('..')
  await expect(successRow).toContainText('passed')
})
