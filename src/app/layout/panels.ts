/**
 * The Advanced Mode panel set.
 *
 * Declared as data so the dock has its full complement of panels from
 * Milestone 6 onward; each entry's `component` is swapped from a placeholder
 * to the real feature component as that feature's milestone lands. Order here
 * is the first-run docking order — after that the user's layout wins.
 */

import {
  Activity,
  Bug,
  Clock,
  FileCode,
  FileText,
  Gauge,
  ListTree,
  Package,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { ManifestExplorer } from '@/features/manifest'
import { CmiInspectorPanel } from '@/features/inspector'
import { ApiMonitorPanel, ConsolePanel } from '@/features/logging'
import { TimelinePanel } from '@/features/timeline'
import { BreakpointsPanel } from '@/features/session'
import { makePlaceholderPanel } from './PlaceholderPanel'
import type { PanelDef } from './PanelRegistry'

export const ADVANCED_PANELS: readonly PanelDef[] = [
  {
    id: 'manifest-explorer',
    title: 'Manifest',
    defaultRegion: 'left',
    defaultOpen: true,
    icon: FileCode,
    component: ManifestExplorer,
  },
  {
    id: 'package-explorer',
    title: 'Package',
    defaultRegion: 'left',
    defaultOpen: false,
    icon: Package,
    component: makePlaceholderPanel('Package Explorer', 'Milestone 14'),
  },
  {
    id: 'cmi-inspector',
    title: 'CMI Inspector',
    defaultRegion: 'right',
    defaultOpen: true,
    icon: ListTree,
    component: CmiInspectorPanel,
  },
  {
    id: 'validation',
    title: 'Validation',
    defaultRegion: 'right',
    defaultOpen: false,
    icon: ShieldCheck,
    component: makePlaceholderPanel('Validation', 'Milestone 10'),
  },
  {
    id: 'api-monitor',
    title: 'API Monitor',
    defaultRegion: 'bottom',
    defaultOpen: true,
    icon: Activity,
    component: ApiMonitorPanel,
  },
  {
    id: 'console',
    title: 'Console',
    defaultRegion: 'bottom',
    defaultOpen: true,
    icon: Terminal,
    component: ConsolePanel,
  },
  {
    id: 'timeline',
    title: 'Timeline',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: Clock,
    component: TimelinePanel,
  },
  {
    id: 'breakpoints',
    title: 'Breakpoints',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: Bug,
    component: BreakpointsPanel,
  },
  {
    id: 'performance',
    title: 'Performance',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: Gauge,
    component: makePlaceholderPanel('Performance', 'Milestone 14'),
  },
  {
    id: 'reports',
    title: 'Reports',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: FileText,
    component: makePlaceholderPanel('Reports', 'Milestone 12'),
  },
]
