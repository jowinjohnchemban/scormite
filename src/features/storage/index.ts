/**
 * Public surface of the "storage" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { StoragePanel } from './components/StoragePanel'
export { useStorageStore } from './state/storageStore'
export { inspectStorage, formatBytes } from './services/StorageService'
export type { StorageEntry, StorageReport } from './services/StorageService'
