import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AdvancedModeShell } from './AdvancedModeShell'
import { usePanelRegistry } from '@/app/layout/PanelRegistry'
import { usePackageStore } from '@/features/package-loader'
import { useRuntimeStore } from '@/features/runtime'
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
  usePackageStore.setState({ package: null })
  useRuntimeStore.setState({ sessionId: null, adapter: null, scormVersion: null })
})

describe('AdvancedModeShell', () => {
  it('mounts the real dock and its initial panels without crashing', async () => {
    render(<AdvancedModeShell />)

    expect(await screen.findByRole('button', { name: /panels/i })).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-left')).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-right')).toBeInTheDocument()
    expect(screen.getByTestId('dock-region-bottom')).toBeInTheDocument()
  })

  it('uses the existing runtime session when entering Advanced Mode after upload', async () => {
    usePackageStore.setState({ package: loadedPackage })
    useRuntimeStore.setState({ sessionId: 'running-session' })
    render(<AdvancedModeShell />)

    expect(await screen.findByTitle('SCORM Package')).toHaveAttribute(
      'src',
      '/scorm-files/running-session/index.html',
    )
  })
})
