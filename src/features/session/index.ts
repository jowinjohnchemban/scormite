/**
 * Public surface of the "session" feature.
 *
 * Owns the Session entity, CMI snapshots, and breakpoint management.
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { BreakpointsPanel } from './components'
export { useBreakpointStore } from './state/breakpointStore'
export {
  BreakpointService,
  describeBreakpoint,
  validateBreakpointDraft,
} from './services/BreakpointService'
export type { BreakpointDraft } from './services/BreakpointService'
export type { ResumeHandler } from './state/breakpointStore'
