/**
 * Public surface of the "validation" feature.
 *
 * Only export what other features are allowed to depend on. Everything else
 * in this folder is an implementation detail.
 */
export { ValidationPanel } from './components'
export { useValidationStore } from './state/validationStore'
export {
  ValidationService,
  validateManifest,
  countBySeverity,
  normalizePackagePath,
  type ManifestValidationContext,
  type StaticFinding,
  type StaticValidator,
} from './services/ValidationService'
