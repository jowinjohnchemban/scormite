/**
 * App-layer wiring between the plugin host and core features.
 *
 * The plugins feature cannot import other features (boundary rule), so every
 * point where a plugin contribution must become a core artifact lives here:
 *  - registering built-in plugins at app startup, and
 *  - adapting plugin validator contributions to the runtime feature's
 *    `RuntimeValidator` shape for the validation middleware.
 */

import type { RuntimeValidator } from '@/features/runtime'
import {
  samplePlugin,
  usePluginHost,
  type PluginValidatorContribution,
} from '@/features/plugins'

let builtinPluginsRegistered = false

/**
 * Register every built-in plugin exactly once, at app startup. Safe to call
 * from anywhere and any number of times — the guard plus the host's own
 * idempotency make double registration a no-op.
 */
export function registerBuiltinPlugins(): void {
  if (builtinPluginsRegistered) return
  builtinPluginsRegistered = true
  usePluginHost.getState().registerPlugin(samplePlugin)
}

/**
 * Adapt a plugin validator contribution to the runtime feature's validator
 * shape. The plugin contract mirrors the runtime result/context types with
 * `method` widened to `string`, so an `ApiCallResult` (whose method is the
 * narrower `ScormApiMethod`) is always a valid `PluginValidationResult`.
 */
function toRuntimeValidator(contribution: PluginValidatorContribution): RuntimeValidator {
  return {
    ruleId: contribution.ruleId,
    severity: contribution.severity,
    check: (result, ctx) => contribution.check(result, ctx),
  }
}

/**
 * The live set of plugin validators, adapted for the validation middleware.
 * Re-read on every call so a plugin registered mid-session takes effect
 * without rebuilding the middleware pipeline.
 */
export function pluginRuntimeValidators(): RuntimeValidator[] {
  return usePluginHost.getState().validators.map(toRuntimeValidator)
}
