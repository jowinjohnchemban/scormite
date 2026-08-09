/**
 * Public surface of the "timeline" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 *
 * Populated incrementally — see /docs/ROADMAP.md for which milestone fills
 * this in.
 */
export { TimelinePanel } from './components'
export { useTimelineStore } from './state/timelineStore'
