/**
 * Minimal interface that adapters expose to the player and other UI features.
 * Lives in shared/ so all features can reference it without boundary violations.
 * The abstract class ScormRuntimeAdapter (in runtime/) implements this.
 */
export interface IScormAdapter {
  initialize(): string
  terminate(): string
  getValue(element: string): string
  setValue(element: string, value: string): string
  commit(): string
  getLastError(): string
  getErrorString(errorCode: string): string
  getDiagnostic(errorCode: string): string
  getFlattenedCmi(): Record<string, string>
}
