/**
 * Session-related entity types shared across features.
 * Owned (constructed/mutated) by the runtime and session features;
 * type lives here so all features can reference without violating boundaries.
 */

export type ScormApiMethod =
  | 'Initialize'
  | 'Terminate'
  | 'GetValue'
  | 'SetValue'
  | 'Commit'
  | 'GetLastError'
  | 'GetErrorString'
  | 'GetDiagnostic'

export interface ApiCallRecord {
  id: string
  sessionId: string
  timestamp: number
  method: ScormApiMethod
  /** CMI element path, when applicable. */
  element?: string
  /** Value passed to SetValue. */
  value?: string
  returnValue: string
  durationMs: number
  /** scorm-again error code string, if non-zero after the call. */
  errorCode?: string
  /** scorm-again's GetErrorString for `errorCode`, e.g. "Incorrect Data Type". */
  errorString?: string
  /** scorm-again's GetDiagnostic, when it says more than `errorString`. */
  diagnostic?: string
}

export interface CmiSnapshot {
  timestamp: number
  sessionId: string
  /** Full CMI tree at this point in time. */
  data: Record<string, string>
  /** Paths that changed vs the previous snapshot. */
  changedPaths: string[]
}

export interface Session {
  id: string
  packageId?: string
  startedAt: Date
  endedAt?: Date
  /** RuntimeProfile id in use for this session. */
  profile: string
  apiCalls: ApiCallRecord[]
  snapshots: CmiSnapshot[]
}
