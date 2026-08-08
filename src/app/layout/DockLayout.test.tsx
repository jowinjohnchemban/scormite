import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Activity } from 'lucide-react'
import { DockLayout } from '@/app/layout/DockLayout'
import { TopToolbar } from '@/app/layout/TopToolbar'
import {
  usePanelRegistry,
  type DockRegion,
  type PanelDef,
} from '@/app/layout/PanelRegistry'

afterEach(cleanup)

function panel(id: string, defaultRegion: DockRegion, defaultOpen = true): PanelDef {
  return {
    id,
    title: id,
    defaultRegion,
    defaultOpen,
    icon: Activity,
    component: () => <div>{id} content</div>,
  }
}

/** A minimal `dataTransfer` — jsdom doesn't implement one. */
function dataTransfer(): DataTransfer {
  const store: Record<string, string> = {}
  return {
    setData: (format: string, value: string) => {
      store[format] = value
    },
    getData: (format: string) => store[format] ?? '',
    effectAllowed: 'move',
    dropEffect: 'move',
  } as unknown as DataTransfer
}

/** Drag `source` and drop it on `target`, the way a pointer drag would. */
function dragAndDrop(source: Element, target: Element): void {
  const dt = dataTransfer()
  fireEvent.dragStart(source, { dataTransfer: dt })
  fireEvent.dragEnter(target, { dataTransfer: dt })
  fireEvent.dragOver(target, { dataTransfer: dt })
  fireEvent.drop(target, { dataTransfer: dt })
  fireEvent.dragEnd(source, { dataTransfer: dt })
}

beforeEach(() => {
  localStorage.clear()
  usePanelRegistry.setState({
    order: { left: [], right: [], bottom: [] },
    hidden: [],
    activeTab: {},
    definitions: {},
    draggingId: null,
  })
  const { register } = usePanelRegistry.getState()
  register(panel('manifest', 'left'))
  register(panel('inspector', 'right'))
  register(panel('monitor', 'bottom'))
  register(panel('console', 'bottom'))
  register(panel('reports', 'bottom', false))
})

const renderDock = () =>
  render(<DockLayout center={<div data-testid="player">player</div>} />)

describe('DockLayout rendering', () => {
  it('renders the center region and every open panel', () => {
    renderDock()
    expect(screen.getByTestId('player')).toBeInTheDocument()
    expect(screen.getByTestId('panel-body-manifest')).toBeInTheDocument()
    expect(screen.getByTestId('panel-body-inspector')).toBeInTheDocument()
  })

  it('shows the bottom dock as tabs, with only the active one mounted', () => {
    renderDock()
    expect(screen.getByRole('tab', { name: 'monitor' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'console' })).toBeInTheDocument()
    expect(screen.getByText('monitor content')).toBeInTheDocument()
    expect(screen.queryByText('console content')).not.toBeInTheDocument()
  })

  it('leaves panels that default to closed out of the dock', () => {
    renderDock()
    expect(screen.queryByRole('tab', { name: 'reports' })).not.toBeInTheDocument()
  })

  it('drops a side dock entirely once its last panel is closed', async () => {
    renderDock()
    await userEvent.click(screen.getByRole('button', { name: 'Close manifest' }))
    expect(screen.queryByTestId('dock-region-left')).not.toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })
})

describe('closing and reopening', () => {
  it('reopens a closed panel from the activity bar', async () => {
    renderDock()
    await userEvent.click(screen.getByRole('button', { name: 'Close manifest' }))
    expect(screen.queryByTestId('panel-body-manifest')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show manifest' }))
    expect(screen.getByTestId('panel-body-manifest')).toBeInTheDocument()
  })

  it('activates the sibling tab when the active tab is closed', async () => {
    renderDock()
    await userEvent.click(screen.getByRole('button', { name: 'Close monitor' }))
    expect(screen.getByText('console content')).toBeInTheDocument()
  })

  it('switches bottom tabs on click', async () => {
    renderDock()
    await userEvent.click(screen.getByRole('tab', { name: 'console' }))
    expect(screen.getByText('console content')).toBeInTheDocument()
    expect(screen.queryByText('monitor content')).not.toBeInTheDocument()
  })

  it('moves between bottom tabs with the arrow keys', async () => {
    renderDock()
    const active = screen.getByRole('tab', { name: 'monitor' })
    active.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'console' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

describe('dragging panels between docks', () => {
  it('re-docks a bottom tab onto a side activity bar', () => {
    renderDock()
    dragAndDrop(
      screen.getByRole('tab', { name: 'console' }),
      screen.getByTestId('activity-bar-right'),
    )
    expect(usePanelRegistry.getState().order.right).toEqual(['inspector', 'console'])
    expect(usePanelRegistry.getState().order.bottom).toEqual(['monitor', 'reports'])
  })

  it('re-docks a side panel into the bottom tab strip', () => {
    renderDock()
    dragAndDrop(
      screen.getByTestId('panel-header-manifest'),
      screen.getByTestId('dock-region-bottom'),
    )
    expect(usePanelRegistry.getState().order.bottom).toEqual([
      'monitor',
      'console',
      'reports',
      'manifest',
    ])
    expect(screen.queryByTestId('dock-region-left')).not.toBeInTheDocument()
  })

  it('reorders tabs by dropping one onto another', () => {
    renderDock()
    dragAndDrop(
      screen.getByRole('tab', { name: 'console' }),
      screen.getByRole('tab', { name: 'monitor' }),
    )
    expect(usePanelRegistry.getState().order.bottom).toEqual([
      'console',
      'monitor',
      'reports',
    ])
  })

  it('stacks a dropped panel into a side dock', () => {
    renderDock()
    dragAndDrop(
      screen.getByRole('tab', { name: 'monitor' }),
      screen.getByTestId('panel-header-manifest'),
    )
    expect(usePanelRegistry.getState().order.left).toEqual(['monitor', 'manifest'])
    expect(screen.getByTestId('panel-body-monitor')).toBeInTheDocument()
  })
})

describe('TopToolbar', () => {
  const renderToolbar = () => render(<TopToolbar />)

  it('toggles panel visibility from the Panels menu', async () => {
    render(
      <>
        <TopToolbar />
        <DockLayout center={<div />} />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: /panels/i }))
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /manifest/i }),
    )
    expect(screen.queryByTestId('panel-body-manifest')).not.toBeInTheDocument()
  })

  it('re-docks a panel from the menu, which is the keyboard path for dragging', async () => {
    renderToolbar()
    await userEvent.click(screen.getByRole('button', { name: /panels/i }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Dock manifest to Bottom' }),
    )
    expect(usePanelRegistry.getState().order.left).toEqual([])
    expect(usePanelRegistry.getState().order.bottom).toContain('manifest')
  })

  it('restores the default layout', async () => {
    usePanelRegistry.getState().move('manifest', 'bottom')
    renderToolbar()
    await userEvent.click(screen.getByRole('button', { name: /panels/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /reset layout/i }))
    expect(usePanelRegistry.getState().order.left).toEqual(['manifest'])
  })

  it('closes the menu on Escape', async () => {
    renderToolbar()
    await userEvent.click(screen.getByRole('button', { name: /panels/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
