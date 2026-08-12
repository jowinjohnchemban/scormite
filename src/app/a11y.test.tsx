/**
 * Milestone 15 — Accessibility AA audit.
 *
 * Exit criteria: axe-core reports no violations in both Basic and Advanced
 * modes. This test renders the real `<App />` (empty state — no package
 * loaded) and audits the rendered DOM with axe-core in each mode.
 *
 * Notes:
 * - jsdom cannot compute real colors, so `color-contrast` results are
 *   incomplete/skipped here; contrast is verified separately in the browser
 *   audit and by the theme tokens in `src/index.css` (see M15 docs).
 * - The audit covers structure: landmarks, headings, ARIA roles/labels,
 *   button names, form labels, focus order, and keyboard-accessible names.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { App } from '@/app/App'
import { useAppModeStore } from '@/app/state/appModeStore'
import { usePackageStore } from '@/features/package-loader'
import { useNetworkStore, type NetworkEntry } from '@/features/player'
import { useLogStore } from '@/features/logging'
import { useStorageStore } from '@/features/storage'
import type { ApiCallRecord, Package } from '@/shared/types'

// Stores are module-level singletons; a previous test switching to Advanced
// mode must not leak into the next render.
beforeEach(() => {
  useAppModeStore.setState({ mode: 'basic' })
})

async function auditApp(): Promise<void> {
  const { container } = render(<App />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
}

describe('accessibility (axe-core, AA)', () => {
  it('has no axe violations in Basic mode', async () => {
    await auditApp()
  })

  it('has no axe violations in Advanced mode', async () => {
    const { container } = render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('exposes the mode switch with accessible names', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Basic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('wraps the app in a visible page landmark', async () => {
    const { container } = render(<App />)
    expect(container.querySelector('main')).not.toBeNull()
    expect(container.querySelector('header')).not.toBeNull()
  })
})

/**
 * Data-rich audit: the panels in Advanced mode (Package Explorer tree,
 * Network table, API monitor, Storage table) only render their interactive
 * content when their stores hold data. Seeding the stores directly is safe —
 * the package load flow only runs through `loadFile`, and `launchUrl` is
 * derived from a runtime session, which stays null here.
 */
describe('accessibility with live data (axe-core, AA)', () => {
  const manifest: Package['manifest'] = {
    defaultOrganizationIdentifier: 'org-1',
    organizations: [
      {
        identifier: 'org-1',
        title: 'Sample Course',
        items: [
          {
            identifier: 'item-1',
            title: 'Lesson 1',
            identifierref: 'res-1',
            isvisible: true,
            children: [],
          },
        ],
      },
    ],
    resources: [
      {
        identifier: 'res-1',
        type: 'webcontent',
        href: 'index.html',
        scormType: 'sco',
        files: ['index.html', 'course/course.css', 'course/js/main.js'],
      },
    ],
    metadata: { schema: 'ADL SCORM', schemaVersion: '1.2', title: 'Sample Course' },
  }

  const pkg: Package = {
    id: 'pkg-sample-1',
    name: 'sample-course',
    sourceType: 'zip',
    scormVersion: '1.2',
    manifest,
    launchUrl: 'index.html',
    loadedAt: new Date('2026-08-11T10:00:00Z'),
  }

  const networkEntries: NetworkEntry[] = [
    {
      id: 'net-1',
      path: '/scorm-files/sess-1/index.html',
      hit: true,
      status: 200,
      timestamp: Date.now() - 1200,
      durationMs: 3,
    },
    {
      id: 'net-2',
      path: '/scorm-files/sess-1/course/course.css',
      hit: true,
      status: 200,
      timestamp: Date.now() - 900,
      durationMs: 1,
    },
    {
      id: 'net-3',
      path: '/scorm-files/sess-1/course/js/main.js',
      hit: false,
      status: 404,
      timestamp: Date.now() - 400,
      durationMs: 12,
    },
  ]

  const logRecords: ApiCallRecord[] = [
    {
      id: 'log-1',
      sessionId: 'sess-1',
      timestamp: Date.now() - 800,
      method: 'Initialize',
      returnValue: 'true',
      durationMs: 0,
    },
    {
      id: 'log-2',
      sessionId: 'sess-1',
      timestamp: Date.now() - 600,
      method: 'SetValue',
      element: 'cmi.core.lesson_location',
      value: '1.2',
      returnValue: 'true',
      durationMs: 1,
    },
    {
      id: 'log-3',
      sessionId: 'sess-1',
      timestamp: Date.now() - 300,
      method: 'GetValue',
      element: 'cmi.core.lesson_location',
      returnValue: '1.2',
      durationMs: 0,
    },
  ]

  beforeEach(() => {
    useAppModeStore.setState({ mode: 'advanced' })
    usePackageStore.setState({
      package: pkg,
      filePaths: ['imsmanifest.xml', 'index.html', 'course/course.css', 'course/js/main.js'],
    })
    useNetworkStore.setState({ entries: networkEntries })
    useLogStore.setState({ records: logRecords })
    useStorageStore.setState({
      refreshing: false,
      report: {
        entries: [
          {
            id: 'st-1',
            origin: 'cache',
            key: 'scormite-pkg-pkg-sample-1',
            kind: 'Cache Storage',
            itemCount: 4,
            sizeBytes: 18_432,
          },
          {
            id: 'st-2',
            origin: 'local',
            key: 'scormite-dock-layout',
            kind: 'localStorage',
            itemCount: null,
            sizeBytes: 842,
          },
        ],
        usageBytes: 19_274,
        quotaBytes: 2_147_483_648,
        generatedAt: new Date('2026-08-11T10:00:00Z'),
      },
    })
  })

  it('has no axe violations in Advanced mode with populated panels', async () => {
    const { container } = render(<App />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
