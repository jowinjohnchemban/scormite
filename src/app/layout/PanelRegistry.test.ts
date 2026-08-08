import { beforeEach, describe, expect, it } from 'vitest'
import { Activity } from 'lucide-react'
import { PANEL_LAYOUT_STORAGE_KEY } from '@/app/layout/dockStorage'
import {
  usePanelRegistry,
  type DockRegion,
  type PanelDef,
} from '@/app/layout/PanelRegistry'

function panel(
  id: string,
  defaultRegion: DockRegion,
  defaultOpen = true,
): PanelDef {
  return {
    id,
    title: id,
    defaultRegion,
    defaultOpen,
    icon: Activity,
    component: () => null,
  }
}

/** Reset to the pre-rehydration state a fresh browser profile would have. */
function resetStore(): void {
  usePanelRegistry.setState({
    order: { left: [], right: [], bottom: [] },
    hidden: [],
    activeTab: {},
    definitions: {},
    draggingId: null,
  })
}

const state = () => usePanelRegistry.getState()

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('register', () => {
  it('docks a new panel into its default region', () => {
    state().register(panel('manifest', 'left'))
    expect(state().order.left).toEqual(['manifest'])
    expect(state().hidden).not.toContain('manifest')
  })

  it('starts a panel hidden when it does not default to open', () => {
    state().register(panel('reports', 'bottom', false))
    expect(state().order.bottom).toEqual(['reports'])
    expect(state().hidden).toContain('reports')
  })

  it('ignores a second registration of the same id', () => {
    state().register(panel('console', 'bottom'))
    state().register(panel('console', 'right'))
    expect(state().order.bottom).toEqual(['console'])
    expect(state().order.right).toEqual([])
  })

  it('preserves order across registrations', () => {
    state().register(panel('a', 'bottom'))
    state().register(panel('b', 'bottom'))
    state().register(panel('c', 'bottom'))
    expect(state().order.bottom).toEqual(['a', 'b', 'c'])
  })
})

// The registry is re-populated by `register` calls on every mount, so a
// rehydrated layout has to win over the defaults baked into those calls --
// otherwise nothing the user changes survives a reload.
describe('register after rehydration', () => {
  it('leaves a panel the user closed closed, despite defaultOpen', () => {
    usePanelRegistry.setState({
      order: { left: [], right: [], bottom: ['api-monitor'] },
      hidden: ['api-monitor'],
    })
    state().register(panel('api-monitor', 'bottom', true))
    expect(state().hidden).toContain('api-monitor')
  })

  it('leaves a panel the user opened open, despite defaultOpen: false', () => {
    usePanelRegistry.setState({
      order: { left: [], right: [], bottom: ['timeline'] },
      hidden: [],
    })
    state().register(panel('timeline', 'bottom', false))
    expect(state().hidden).not.toContain('timeline')
  })

  it('keeps a panel in the region the user moved it to', () => {
    usePanelRegistry.setState({
      order: { left: [], right: ['api-monitor'], bottom: [] },
      hidden: [],
    })
    state().register(panel('api-monitor', 'bottom', true))
    expect(state().order.right).toEqual(['api-monitor'])
    expect(state().order.bottom).toEqual([])
  })

  it('still applies defaults to a panel the persisted layout has never seen', () => {
    usePanelRegistry.setState({
      order: { left: [], right: [], bottom: ['api-monitor'] },
      hidden: [],
    })
    state().register(panel('breakpoints', 'bottom', false))
    expect(state().order.bottom).toEqual(['api-monitor', 'breakpoints'])
    expect(state().hidden).toContain('breakpoints')
  })
})

describe('visibility', () => {
  beforeEach(() => {
    state().register(panel('a', 'bottom'))
    state().register(panel('b', 'bottom'))
  })

  it('toggles a panel closed and open again', () => {
    state().toggle('a')
    expect(state().hidden).toContain('a')
    state().toggle('a')
    expect(state().hidden).not.toContain('a')
  })

  it('promotes the next visible sibling when the active tab is closed', () => {
    state().setActiveTab('bottom', 'a')
    state().close('a')
    expect(state().activeTab.bottom).toBe('b')
  })

  it('clears the active tab when the last visible panel is closed', () => {
    state().setActiveTab('bottom', 'a')
    state().close('b')
    state().close('a')
    expect(state().activeTab.bottom).toBeUndefined()
  })

  it('makes a reopened panel the active tab', () => {
    state().close('b')
    state().open('b')
    expect(state().activeTab.bottom).toBe('b')
  })
})

describe('move', () => {
  beforeEach(() => {
    state().register(panel('a', 'bottom'))
    state().register(panel('b', 'bottom'))
    state().register(panel('c', 'left'))
  })

  it('re-docks a panel to another region', () => {
    state().move('a', 'right')
    expect(state().order.bottom).toEqual(['b'])
    expect(state().order.right).toEqual(['a'])
  })

  it('inserts before the given panel when reordering', () => {
    state().move('b', 'bottom', 'a')
    expect(state().order.bottom).toEqual(['b', 'a'])
  })

  it('appends when no anchor is given', () => {
    state().move('c', 'bottom')
    expect(state().order.bottom).toEqual(['a', 'b', 'c'])
  })

  it('reveals a hidden panel that gets dragged somewhere', () => {
    state().close('a')
    state().move('a', 'left')
    expect(state().hidden).not.toContain('a')
  })

  it('hands the source region a new active tab', () => {
    state().setActiveTab('bottom', 'a')
    state().move('a', 'left')
    expect(state().activeTab.bottom).toBe('b')
    expect(state().activeTab.left).toBe('a')
  })

  it('is a no-op when a panel is dropped on itself', () => {
    state().move('a', 'bottom', 'a')
    expect(state().order.bottom).toEqual(['a', 'b'])
  })
})

describe('resetLayout', () => {
  it('restores registered defaults', () => {
    state().register(panel('a', 'bottom', true))
    state().register(panel('b', 'left', false))
    state().move('a', 'right')
    state().open('b')

    state().resetLayout()

    expect(state().order.bottom).toEqual(['a'])
    expect(state().order.left).toEqual(['b'])
    expect(state().order.right).toEqual([])
    expect(state().hidden).toEqual(['b'])
  })

  it('discards stored region sizes but leaves unrelated keys alone', () => {
    localStorage.setItem('react-resizable-panels:scormite-dock-shell:workspace', '{}')
    localStorage.setItem('unrelated-key', 'keep me')

    state().resetLayout()

    expect(
      localStorage.getItem('react-resizable-panels:scormite-dock-shell:workspace'),
    ).toBeNull()
    expect(localStorage.getItem('unrelated-key')).toBe('keep me')
  })
})

// Milestone 6 exit criterion: the layout survives a reload. Everything above
// tests the pieces; this drives the actual round trip through localStorage.
describe('persistence across a reload', () => {
  async function simulateReload(): Promise<void> {
    // A reload starts with no in-memory state, then rehydrates from storage,
    // then the shell re-registers every panel. Clearing the store writes
    // through the persist middleware, so what storage held is captured first
    // and put back — otherwise the reset would erase the thing under test.
    const saved = localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY)
    resetStore()
    if (saved === null) localStorage.removeItem(PANEL_LAYOUT_STORAGE_KEY)
    else localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, saved)

    await usePanelRegistry.persist.rehydrate()
    state().register(panel('manifest', 'left', true))
    state().register(panel('monitor', 'bottom', true))
    state().register(panel('reports', 'bottom', false))
  }

  beforeEach(() => {
    state().register(panel('manifest', 'left', true))
    state().register(panel('monitor', 'bottom', true))
    state().register(panel('reports', 'bottom', false))
  })

  it('restores a panel moved to another dock', async () => {
    state().move('manifest', 'bottom')
    await simulateReload()
    expect(state().order.left).toEqual([])
    expect(state().order.bottom).toContain('manifest')
  })

  it('restores a closed panel as closed', async () => {
    state().close('monitor')
    await simulateReload()
    expect(state().hidden).toContain('monitor')
  })

  it('restores a reopened panel as open', async () => {
    state().open('reports')
    await simulateReload()
    expect(state().hidden).not.toContain('reports')
  })

  it('restores the active bottom tab', async () => {
    state().open('reports')
    state().setActiveTab('bottom', 'reports')
    await simulateReload()
    expect(state().activeTab.bottom).toBe('reports')
  })

  it('falls back to defaults when nothing was persisted', async () => {
    localStorage.clear()
    await simulateReload()
    expect(state().order.left).toEqual(['manifest'])
    expect(state().order.bottom).toEqual(['monitor', 'reports'])
    expect(state().hidden).toEqual(['reports'])
  })
})

describe('unregister', () => {
  it('drops the definition but remembers where the panel was docked', () => {
    state().register(panel('a', 'right'))
    state().unregister('a')
    expect(state().definitions['a']).toBeUndefined()
    expect(state().order.right).toEqual(['a'])

    state().register(panel('a', 'bottom'))
    expect(state().order.right).toEqual(['a'])
  })
})
