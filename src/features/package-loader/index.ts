/**
 * Public surface of the "package-loader" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { DropZone } from './components/DropZone'
export { PackageExplorerPanel } from './components/PackageExplorerPanel'
export { usePackageStore } from './state/packageStore'
export { loadZip, PackageLoadError } from './services/PackageLoaderService'
export { detectScormVersion } from './services/PackageDetectionService'
export type { RawPackageData } from './services/PackageLoaderService'
export type { DetectedVersion } from './services/PackageDetectionService';
