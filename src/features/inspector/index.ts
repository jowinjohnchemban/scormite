/**
 * Public surface of the "inspector" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { CmiInspectorPanel } from './components'
export { useInspectorStore } from './state/inspectorStore'
