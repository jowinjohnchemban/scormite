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
  ListOrdered,
  ListTree,
  Network,
  Package,
  ShieldCheck,
} from 'lucide-react'
import { ManifestExplorer } from '@/features/manifest'
import { CmiInspectorPanel } from '@/features/inspector'
import { ApiMonitorPanel, PerformancePanel } from '@/features/logging'
import { PackageExplorerPanel } from '@/features/package-loader'
import { NetworkPanel } from '@/features/player'
import { TimelinePanel } from '@/features/timeline'
import { BreakpointsPanel } from '@/features/session'
import { ValidationPanel } from '@/features/validation'
import { CourseOutlinePanel } from '@/app/course/CourseOutline'
import { ReportsPanelWrapper } from './ReportsPanelWrapper'
import type { PanelDef } from './PanelRegistry'

export const ADVANCED_PANELS: readonly PanelDef[] = [
  {
    id: 'course-outline',
    title: 'Outline',
    defaultRegion: 'left',
    defaultOpen: true,
    icon: ListOrdered,
    component: CourseOutlinePanel,
  },
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
    component: PackageExplorerPanel,
  },
  {
    id: 'network',
    title: 'Network',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: Network,
    component: NetworkPanel,
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
    component: ValidationPanel,
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
    component: PerformancePanel,
  },
  {
    id: 'reports',
    title: 'Reports',
    defaultRegion: 'bottom',
    defaultOpen: false,
    icon: FileText,
    component: ReportsPanelWrapper,
  },
]
