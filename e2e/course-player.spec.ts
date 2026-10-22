/**
 * End-to-end: the course player — multi-SCO outline navigation, LMS launch
 * data from the manifest, resume vs. new attempt, SCORM 2004 navigation
 * requests, folder-wrapped packages, and opening / closing packages from
 * the header.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture = (name: string) => path.join(fixturesDir, name)

const PLAYER = 'iframe[title="SCORM Package"]'

function playerBody(page: Page) {
  return page.frameLocator(PLAYER).locator('body')
}

test('navigates a multi-SCO 1.2 course and resumes each SCO like an LMS', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm12-multi-sco.zip'))

  const outline = page.getByRole('region', { name: 'Course outline' })
  await expect(outline.getByText('Item 1 of 2')).toBeVisible()

  // First SCO: launch data + mastery score from the manifest, item
  // parameters on the launch URL (served despite the query string), fresh entry.
  await expect(playerBody(page)).toContainText(
    'lesson-one | entry=ab-initio | suspend= | launch_data=from-manifest | mastery=70 | query=?mode=test',
    { timeout: 15_000 },
  )

  // Next item from the outline.
  await outline.getByRole('button', { name: 'Next item' }).click()
  await expect(playerBody(page)).toContainText('lesson-two | entry=ab-initio |')
  await expect(outline.getByText('Item 2 of 2')).toBeVisible()

  // Back to the first: it resumes from its suspended attempt.
  await outline.getByRole('button', { name: /Lesson One/ }).click()
  await expect(playerBody(page)).toContainText('lesson-one | entry=resume | suspend=lesson-one-state')

  // New attempt discards the stored data.
  await page.getByRole('button', { name: 'Restart' }).click()
  await page.getByRole('menuitem', { name: /New attempt/ }).click()
  await expect(playerBody(page)).toContainText('lesson-one | entry=ab-initio | suspend= |')

  // Close returns to the empty state.
  await page.getByRole('button', { name: /Close/ }).click()
  await expect(page.getByRole('button', { name: /Drop SCORM ZIP here/i })).toBeVisible()
})

test('follows a SCORM 2004 continue navigation request to the next SCO', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm2004-flow.zip'))

  // The intro SCO terminates with adl.nav.request=continue; the player
  // delivers the quiz on its own, seeded with its completion threshold.
  await expect(playerBody(page)).toContainText('quiz delivered | threshold=0.8', { timeout: 15_000 })
  const outline = page.getByRole('region', { name: 'Course outline' })
  await expect(outline.getByRole('button', { name: /Quiz/ })).toHaveAttribute('aria-current', 'step')
  await expect(outline.getByText('Item 2 of 2')).toBeVisible()
})

test('opens a folder-wrapped zip and reports it as a packaging error', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm12-folder-wrapped.zip'))

  await expect(playerBody(page)).toContainText('init=true', { timeout: 15_000 })
  await expect(page.getByText(/1 package error/)).toBeVisible()
})

test('opens another package from the header without a page reload', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm12-basic.zip'))
  await expect(page.getByText('scorm12-basic', { exact: true })).toBeVisible()
  await expect(playerBody(page)).toContainText('init=', { timeout: 15_000 })

  // With a package open, the only file input is the header's Open control.
  await page.setInputFiles('input[type="file"]', fixture('scorm2004-basic.zip'))
  await expect(page.getByText('scorm2004-basic', { exact: true })).toBeVisible()
  await expect(page.getByText('scorm12-basic', { exact: true })).toHaveCount(0)
  await expect(playerBody(page)).toContainText('setStatus=true', { timeout: 15_000 })
})

test('enforces SCORM 2004 sequencing rules from the manifest', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm2004-sequenced.zip'))

  const outline = page.getByRole('region', { name: 'Course outline' })
  await expect(outline.getByText('sequenced')).toBeVisible({ timeout: 15_000 })

  // The quiz's precondition rule disables it until the intro is passed.
  const quiz = outline.getByRole('button', { name: /Gated Quiz/ })
  await expect(quiz).toBeDisabled()
  await expect(outline.getByRole('button', { name: /Gated Intro/ })).toHaveAttribute('aria-current', 'step')

  // Passing the intro writes the shared objective; its continue request is
  // then allowed and the engine delivers the quiz.
  await page.frameLocator(PLAYER).getByRole('button', { name: 'Pass and continue' }).click()
  await expect(playerBody(page)).toContainText('gated quiz delivered', { timeout: 15_000 })
  await expect(quiz).toHaveAttribute('aria-current', 'step')
  await expect(outline.getByRole('button', { name: /Gated Intro/ })).toBeEnabled()
})

test('resumes saved progress after a page reload', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[type="file"]', fixture('scorm12-multi-sco.zip'))
  const outline = page.getByRole('region', { name: 'Course outline' })
  await expect(playerBody(page)).toContainText('lesson-one |', { timeout: 15_000 })
  await outline.getByRole('button', { name: 'Next item' }).click()
  // lesson-two suspends and commits on load — the moment progress is saved.
  await expect(playerBody(page)).toContainText('lesson-two | entry=ab-initio |')
  // Commits are saved after a short coalescing window; no person reloads faster.
  await page.waitForTimeout(400)

  await page.reload()
  await page.setInputFiles('input[type="file"]', fixture('scorm12-multi-sco.zip'))
  await expect(page.getByText(/Resumed the progress saved in this browser/)).toBeVisible({ timeout: 15_000 })
  await expect(playerBody(page)).toContainText('lesson-two | entry=resume | suspend=lesson-two-state')
  await expect(outline.getByRole('button', { name: /Lesson Two/ })).toHaveAttribute('aria-current', 'step')
})
