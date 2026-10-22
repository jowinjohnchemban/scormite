/**
 * Public surface of the "session" feature.
 *
 * Owns breakpoints: the conditions that hold a SetValue / Commit for inspection.
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { BreakpointsPanel } from './components'
export { useBreakpointStore } from './state/breakpointStore'
export { BreakpointService, describeBreakpoint, validateBreakpointDraft } from './services/BreakpointService'
export type { BreakpointDraft } from './services/BreakpointService'
export type { ResumeHandler } from './state/breakpointStore'
