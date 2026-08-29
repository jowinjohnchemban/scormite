/**
 * End-to-end: loading a SCORM 1.2 package through the real drop zone and
 * verifying the full pipeline works in a browser — unzip → manifest parse →
 * service-worker caching → iframe launch → API proxy → scorm-again adapter →
 * live CMI state.
 *
 * Fixtures are committed (see `scripts/make-fixtures.mjs`); the 1.2 fixture's
 * SCO calls `window.parent.API` and writes its results to the document body.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const packageZip = path.join(fixturesDir, 'scorm12-basic.zip')

test('loads a SCORM 1.2 package and runs the SCO end to end', async ({ page }) => {
  await page.goto('/')

  // Empty state: drop zone is the entry point.
  await expect(page.getByRole('button', { name: /Drop SCORM ZIP here/i })).toBeVisible()

  // Feed the zip through the hidden file input.
  await page.setInputFiles('input[type="file"]', packageZip)

  // Sidebar shows package name + version once loaded.
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible()

  // Manifest tree: organization and SCO item are rendered as buttons.
  await expect(page.getByRole('button', { name: /E2E Org 1.2/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /E2E SCO 1.2/i })).toBeVisible()

  // The SCO iframe is launched through the service worker (scorm-files URL).
  const player = page.frameLocator('iframe[title="SCORM Package"]')
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute(
    'src',
    /\/scorm-files\//,
    { timeout: 15_000 },
  )

  // The SCO ran against the injected API: its log is written to the body.
  await expect(player.locator('body')).toContainText('init=', { timeout: 15_000 })

  // CMI summary reflects what the SCO set: lesson_status completed, raw 100.
  const statusRow = page.getByText('Status', { exact: true }).locator('..')
  await expect(statusRow).toContainText('completed', { timeout: 15_000 })
  const scoreRow = page.getByText('Score', { exact: true }).locator('..')
  await expect(scoreRow).toContainText('100')
})
