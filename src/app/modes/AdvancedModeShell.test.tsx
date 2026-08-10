import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AdvancedModeShell } from './AdvancedModeShell'
import { usePanelRegistry } from '@/app/layout/PanelRegistry'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import type { Package } from '@/shared/types'

const loadedPackage: Package = {
  id: 'loaded-package',
  name: 'example-course',
  sourceType: 'zip',
  scormVersion: '1.2',
  manifest: { organizations: [], resources: [], metadata: {} },
  launchUrl: 'index.html',
  loadedAt: new Date(),
}

// The shell receives the session as a prop from App (which owns the single
// usePackageSession subscription and the persistent player layer).
const sessionWithPackage: PackageSession = {
  pkg: loadedPackage,
  loading: false,
  error: null,
  launchUrl: '/scorm-files/running-session/index.html',
  loadFile: async () => {},
  reload: () => {},
  reset: () => {},
}

const emptySession: PackageSession = {
  pkg: null,
  loading: false,
  error: null,
  launchUrl: null,
  loadFile: async () => {},
  reload: () => {},
  reset: () => {},
}

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  usePanelRegistry.setState({
    order: { left: [], right: [], bottom: [] },
    hidden: [],
    activeTab: {},
    definitions: {},
    draggingId: null,
  })
})

describe('AdvancedModeShell', () => {
  it('mounts the real dock and its initial panels without crashing', async () => {
    render(<AdvancedModeShell session={sessionWithPackage} />)

    expect(await screen.findByRole('button', { name: /panels/i })).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-left')).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-right')).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-bottom')).toBeInTheDocument()
  })

  it('renders the player toolbar in the center when a session is running', () => {
    render(<AdvancedModeShell session={sessionWithPackage} />)

    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()
    // The shell no longer renders the iframe itself — App does, persistently.
    expect(screen.queryByTitle('SCORM Package')).not.toBeInTheDocument()
  })

  it('disables the player toolbar while the launch URL is unavailable', () => {
    // A loaded package with no launch URL (e.g. mid-reload) still shows the
    // toolbar, but disabled — the shell never drops the reload affordance.
    render(
      <AdvancedModeShell
        session={{ ...sessionWithPackage, launchUrl: null }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })

  it('shows the drop zone instead of the toolbar before a package loads', () => {
    render(<AdvancedModeShell session={emptySession} />)

    expect(screen.getByRole('button', { name: /drop scorm zip/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })
})
