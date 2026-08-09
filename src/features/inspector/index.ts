/**
 * Public surface of the "inspector" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 *
 * Populated incrementally — see /docs/ROADMAP.md for which milestone fills
 * this in.
 */
export { CmiInspectorPanel } from './components'
export { useInspectorStore } from './state/inspectorStore'
