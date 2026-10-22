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
  ListOrdered,
  ListTree,
  Network,
  Package,
  ShieldCheck,
} from 'lucide-react'
import { ManifestExplorer } from '@/features/manifest'
import { CmiInspectorPanel } from '@/features/inspector'
import { ApiMonitorPanel } from '@/features/logging'
import { PackageExplorerPanel } from '@/features/package-loader'
import { NetworkPanel } from '@/features/player'
import { TimelinePanel } from '@/features/timeline'
import { BreakpointsPanel } from '@/features/session'
import { ValidationPanel } from '@/features/validation'
import { CourseOutlinePanel } from '@/app/course/CourseOutline'
import type { PanelDef } from './PanelRegistry'

export const ADVANCED_PANELS: readonly PanelDef[] = [
  {
    id: 'course-outline',
    group: 'course',
    title: 'Outline',
    region: 'left',
    defaultOpen: true,
    icon: ListOrdered,
    component: CourseOutlinePanel,
  },
  {
    id: 'manifest-explorer',
    group: 'course',
    title: 'Manifest',
    region: 'left',
    defaultOpen: true,
    icon: FileCode,
    component: ManifestExplorer,
  },
  {
    id: 'package-explorer',
    group: 'course',
    title: 'Package',
    region: 'left',
    defaultOpen: false,
    icon: Package,
    component: PackageExplorerPanel,
  },
  {
    id: 'network',
    group: 'problems',
    title: 'Network',
    region: 'bottom',
    defaultOpen: false,
    icon: Network,
    component: NetworkPanel,
  },

  {
    id: 'cmi-inspector',
    group: 'runtime',
    title: 'CMI Inspector',
    region: 'right',
    defaultOpen: true,
    icon: ListTree,
    component: CmiInspectorPanel,
  },
  {
    id: 'validation',
    group: 'problems',
    title: 'Validation',
    region: 'right',
    defaultOpen: false,
    icon: ShieldCheck,
    component: ValidationPanel,
  },
  {
    id: 'api-monitor',
    group: 'runtime',
    title: 'API Monitor',
    region: 'bottom',
    defaultOpen: true,
    icon: Activity,
    component: ApiMonitorPanel,
  },

  {
    id: 'timeline',
    group: 'runtime',
    title: 'Timeline',
    region: 'bottom',
    defaultOpen: false,
    icon: Clock,
    component: TimelinePanel,
  },
  {
    id: 'breakpoints',
    group: 'runtime',
    title: 'Breakpoints',
    region: 'bottom',
    defaultOpen: false,
    icon: Bug,
    component: BreakpointsPanel,
  },
]
