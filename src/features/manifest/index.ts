/**
 * Public surface of the "manifest" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { ManifestExplorer } from './components/ManifestExplorer'
export { useManifestStore } from './state/manifestStore'
export { parseManifest, ManifestParseError } from './services/ManifestParserService'
export {
  applyLaunchParameters,
  getDefaultOrganization,
  getLaunchableItems,
} from './services/launchables'
