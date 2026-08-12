/**
 * End-to-end: Basic ↔ Advanced mode switches. The SCO iframe must survive
 * the switch (it lives in the persistent player layer), and each mode's
 * chrome must render its own package status.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const packageZip = path.join(fixturesDir, 'scorm12-basic.zip')

test('switches Basic ↔ Advanced without killing the running SCO', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', packageZip)

  // Basic mode chrome.
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible()

  // Capture the launched iframe before switching.
  const player = page.frameLocator('iframe[title="SCORM Package"]')
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute(
    'src',
    /\/scorm-files\//,
    { timeout: 15_000 },
  )
  const srcBefore = await page.locator('iframe[title="SCORM Package"]').getAttribute('src')

  // Switch to Advanced.
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.locator('[data-testid="dock-region-left"]')).toBeVisible()

  // Advanced chrome: package status in the top toolbar, Manifest panel open by default.
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible()
  await expect(
    page.locator('[data-testid="panel-header-manifest-explorer"]'),
  ).toBeVisible()

  // The SCO iframe is untouched by the switch.
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute(
    'src',
    srcBefore ?? '',
  )
  await expect(player.locator('body')).toContainText('init=')

  // Switch back to Basic.
  await page.getByRole('button', { name: 'Basic', exact: true }).click()
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute(
    'src',
    srcBefore ?? '',
  )
})
