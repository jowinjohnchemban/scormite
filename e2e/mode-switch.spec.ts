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

test('switches to Advanced mode after a deployment replaced its file', async ({ page }) => {
  // The page fetches Advanced mode once it has loaded and the browser is idle.
  const preloaded = page.waitForResponse((response) => /AdvancedModeShell/.test(response.url()))
  await page.goto('/')
  await preloaded

  // A deployment replaces the file: the host now answers its old URL with the
  // app's HTML page, as a single-page-app fallback does.
  await page.route(/AdvancedModeShell/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>SCORMite</title>' }),
  )

  await page.setInputFiles('input[type="file"]', packageZip)
  const player = page.frameLocator('iframe[title="SCORM Package"]')
  await expect(player.locator('body')).toContainText('init=', { timeout: 15_000 })

  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.locator('[data-testid="dock-region-left"]')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(player.locator('body')).toContainText('init=')
})

test('switches Basic ↔ Advanced without killing the running SCO', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', packageZip)

  // Basic mode chrome.
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible()

  // Capture the launched iframe before switching.
  const player = page.frameLocator('iframe[title="SCORM Package"]')
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute('src', /\/scorm-files\//, {
    timeout: 15_000,
  })
  const srcBefore = await page.locator('iframe[title="SCORM Package"]').getAttribute('src')

  // Switch to Advanced.
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.locator('[data-testid="dock-region-left"]')).toBeVisible()

  // Advanced chrome: package status in the top toolbar, Manifest panel open by default.
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible()
  await expect(page.locator('[data-testid="panel-header-manifest-explorer"]')).toBeVisible()

  // The SCO iframe is untouched by the switch.
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute('src', srcBefore ?? '')
  await expect(player.locator('body')).toContainText('init=')

  // Switch back to Basic.
  await page.getByRole('button', { name: 'Basic', exact: true }).click()
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(page.locator('iframe[title="SCORM Package"]')).toHaveAttribute('src', srcBefore ?? '')
})
