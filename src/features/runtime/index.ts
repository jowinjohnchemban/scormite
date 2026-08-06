/**
 * Public surface of the "runtime" feature.
 * Only src/features/runtime may import scorm-again — enforced by ESLint.
 */
export { ScormRuntimeAdapter } from './adapter/ScormRuntimeAdapter'
export { Scorm12Adapter } from './adapter/Scorm12Adapter'
export { Scorm2004Adapter } from './adapter/Scorm2004Adapter'
export { recordingMiddleware } from './adapter/middleware/recordingMiddleware'
export { runtimeEvents } from './events/RuntimeEventEmitter'
export { useRuntimeStore } from './state/runtimeStore'
export type { RuntimeMiddleware, ApiCallContext, ApiCallResult } from './types';
