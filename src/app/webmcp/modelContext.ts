/**
 * The slice of the WebMCP API SCORMite uses (W3C Web Machine Learning CG,
 * https://webmachinelearning.github.io/webmcp/). TypeScript's DOM library does
 * not describe it yet, so it is typed here and feature-detected: browsers
 * without WebMCP get `null` and SCORMite registers nothing.
 */

export interface ToolAnnotations {
  /** The tool only reads state. */
  readOnlyHint?: boolean
  /** The result contains content the site does not vouch for (here: package data). */
  untrustedContentHint?: boolean
  /** Running the tool has significant or non-reversible effects. */
  consequentialHint?: boolean
}

export interface ModelContextTool {
  name: string
  title?: string
  description: string
  /** JSON Schema of the input object. */
  inputSchema?: object
  /** Returns a JSON-serializable result; the browser serializes it for the agent. */
  execute: (input: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<unknown>
  annotations?: ToolAnnotations
}

export interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void>
}

/** The document's `modelContext`, or null where the browser does not support WebMCP. */
export function getModelContext(doc: Document = document): ModelContext | null {
  const context = (doc as Document & { modelContext?: Partial<ModelContext> }).modelContext
  return context && typeof context.registerTool === 'function' ? (context as ModelContext) : null
}
