/** Browser event name for development-only Scormite diagnostics. */
const SCORMITE_DIAGNOSTIC_EVENT = 'scormite:diagnostic'

export interface ScormiteDiagnostic {
  type: string
  timestamp: string
  detail: Record<string, unknown>
}

/**
 * Records a structured development event in the browser console and dispatches
 * it on `window`. This is intentionally a production no-op: package metadata
 * and runtime activity should never become application telemetry.
 */
export function logDevDiagnostic(type: string, detail: Record<string, unknown> = {}): void {
  if (!import.meta.env.DEV) return

  const diagnostic: ScormiteDiagnostic = {
    type,
    timestamp: new Date().toISOString(),
    detail,
  }
  console.debug('[Scormite diagnostic]', diagnostic)
  window.dispatchEvent(new CustomEvent<ScormiteDiagnostic>(SCORMITE_DIAGNOSTIC_EVENT, { detail: diagnostic }))
}
