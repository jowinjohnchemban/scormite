/**
 * Public surface of the "timeline" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { TimelinePanel } from './components'
export { useTimelineStore } from './state/timelineStore'
