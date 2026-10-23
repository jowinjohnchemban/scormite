/**
 * WebMCP tools that open the rest of SCORMite to an agent: calling the SCORM
 * API as the SCO does, running a script in the SCO's page, waiting for the
 * course to reach a state, and opening or closing a package.
 */

import { usePackageStore } from '@/features/package-loader'
import { useRuntimeStore } from '@/features/runtime'
import type { ModelContextTool } from './modelContext'
import { readBounded } from './readBounded'
import { scoDocument } from './scoPage'
import type { ToolHost } from './tools'

const NO_PACKAGE = { error: 'No package is open. Ask the user to drop a SCORM .zip on the SCORMite page.' }
const NOT_RUNNING = { error: 'No item is running yet. Use launch_item first.' }
/** Results are cut to this many characters of JSON. */
const MAX_RESULT_CHARS = 50_000
/** Packages fetched from a URL can be at most this large. */
const MAX_PACKAGE_BYTES = 500_000_000

const string = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const METHODS = [
  'Initialize',
  'Terminate',
  'GetValue',
  'SetValue',
  'Commit',
  'GetLastError',
  'GetErrorString',
  'GetDiagnostic',
]
/** SCORM 1.2 names of the SCORM 2004 methods. */
const SCORM12: Record<string, string> = { Initialize: 'LMSInitialize', Terminate: 'LMSFinish' }

type ScormApi = Record<string, ((...args: string[]) => string) | undefined>

/** The API object the SCO finds on SCORMite's window. */
function scormApi(): { api: ScormApi; v12: boolean } | null {
  const w = window as unknown as Record<string, ScormApi | undefined>
  const api2004 = w['API_1484_11']
  if (api2004) return { api: api2004, v12: false }
  const api12 = w['API']
  return api12 ? { api: api12, v12: true } : null
}

/** A JSON-safe copy of a script's result, cut to size. */
export function toJsonResult(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof Node !== 'undefined' && value instanceof Node) {
    const markup = value instanceof Element ? value.outerHTML : (value.textContent ?? '')
    return markup.slice(0, MAX_RESULT_CHARS)
  }
  let json: string | undefined
  try {
    json = JSON.stringify(value)
  } catch {
    return String(value).slice(0, MAX_RESULT_CHARS)
  }
  if (json === undefined) return String(value)
  return json.length > MAX_RESULT_CHARS
    ? { truncated: true, json: json.slice(0, MAX_RESULT_CHARS) }
    : (JSON.parse(json) as unknown)
}

/** The text the running SCO's page shows: rendered text, without hidden elements or scripts. */
function shownText(): string {
  const body = scoDocument()?.body
  if (!body) return ''
  // innerText is the rendered text; environments without layout lack it.
  const rendered = (body as { innerText?: string }).innerText
  return typeof rendered === 'string' ? rendered : (body.textContent ?? '')
}

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason as Error)
      },
      { once: true },
    )
  })

export function createAutomationTools(host: ToolHost): ModelContextTool[] {
  return [
    {
      name: 'call_scorm_api',
      title: 'Call the SCORM API',
      description:
        "Call the SCORM API of the running item exactly as its SCO would — Initialize, Terminate, GetValue, SetValue, Commit, GetLastError, GetErrorString, GetDiagnostic (SCORM 2004 names; SCORM 1.2 packages get the LMS… equivalents). Use it to set up a state to test (a score, a status, suspend data), probe the data model and its error codes, or reproduce a bug. Calls appear in the API log and change the attempt's data.",
      inputSchema: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: METHODS },
          element: { type: 'string', description: 'CMI element for GetValue / SetValue, e.g. cmi.score.raw' },
          value: { type: 'string', description: 'Value for SetValue' },
          errorCode: { type: 'string', description: 'For GetErrorString / GetDiagnostic' },
        },
        required: ['method'],
      },
      annotations: { untrustedContentHint: true, consequentialHint: true },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const found = scormApi()
        if (!found || !useRuntimeStore.getState().adapter) return NOT_RUNNING
        const method = string(input['method']) ?? ''
        if (!METHODS.includes(method)) return { error: `method must be one of ${METHODS.join(', ')}.` }
        const element = string(input['element']) ?? ''
        const name = found.v12 ? (SCORM12[method] ?? `LMS${method}`) : method
        const args =
          method === 'GetValue'
            ? [element]
            : method === 'SetValue'
              ? [element, string(input['value']) ?? '']
              : method === 'GetErrorString' || method === 'GetDiagnostic'
                ? [string(input['errorCode']) ?? '']
                : ['']
        if ((method === 'GetValue' || method === 'SetValue') && !element) return { error: 'element is required.' }
        const result = found.api[name]?.(...args) ?? ''
        const errorCode = found.api[found.v12 ? 'LMSGetLastError' : 'GetLastError']?.() ?? '0'
        return {
          method: name,
          result,
          errorCode,
          ...(errorCode !== '0'
            ? { errorString: found.api[found.v12 ? 'LMSGetErrorString' : 'GetErrorString']?.(errorCode) ?? '' }
            : {}),
        }
      },
    },
    {
      name: 'run_script_in_sco',
      title: "Run a script in the course's page",
      description:
        "Run JavaScript in the running SCO's page and return its result (as JSON; elements as their HTML). The script is the body of an async function: use `return`, and `await` if needed; `document` and `window` are the SCO's. Use it for anything the other tools do not cover — inspect state the course keeps in its own variables, trigger its functions, drag and drop, fill a canvas, skip a video, or check layout. It runs with the same access the course's own scripts have. timeoutMs only limits how long the tool waits for the result: a script still running after it keeps running, and one that never yields blocks the page.",
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'Body of an async function, e.g. "return document.title"' },
          timeoutMs: { type: 'integer', minimum: 100, maximum: 60000, description: 'Default 10000' },
        },
        required: ['script'],
      },
      annotations: { untrustedContentHint: true, consequentialHint: true },
      execute: async (input, { signal }) => {
        if (!host.session().pkg) return NO_PACKAGE
        const view = scoDocument()?.defaultView
        if (!view) return NOT_RUNNING
        const script = string(input['script'])
        if (!script) return { error: 'script is required.' }
        const timeout = Math.min(Math.max(Math.trunc(Number(input['timeoutMs'])) || 10000, 100), 60000)
        try {
          // The SCO's own Function constructor, so the script runs with its globals.
          const run = new (view as unknown as { Function: FunctionConstructor }).Function(
            `return (async () => {\n${script}\n})()`,
          ) as () => Promise<unknown>
          const result = await Promise.race([
            run(),
            delay(timeout, signal).then(() => {
              throw new Error(`No result within ${timeout} ms; the script may still be running.`)
            }),
          ])
          return { result: toJsonResult(result) }
        } catch (error) {
          return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
        }
      },
    },
    {
      name: 'wait_for',
      title: 'Wait for the course',
      description:
        "Wait until the running SCO's page shows some text, or a CMI element has a value (or any value), or both — for example after a launch, a click, or a video. Returns as soon as the condition holds, or reports a timeout.",
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text the page should show (case-insensitive)' },
          element: { type: 'string', description: 'CMI element to watch, e.g. cmi.completion_status' },
          value: { type: 'string', description: 'The value it should reach (default: any non-empty value)' },
          timeoutMs: { type: 'integer', minimum: 100, maximum: 60000, description: 'Default 10000' },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input, { signal }) => {
        if (!host.session().pkg) return NO_PACKAGE
        const text = string(input['text'])?.toLowerCase()
        const element = string(input['element'])
        const value = string(input['value'])
        if (!text && !element) return { error: 'Give text, element, or both.' }
        const timeout = Math.min(Math.max(Math.trunc(Number(input['timeoutMs'])) || 10000, 100), 60000)
        const started = Date.now()
        const met = () => {
          if (text && !shownText().toLowerCase().includes(text)) return false
          if (element) {
            const current = useRuntimeStore.getState().adapter?.getFlattenedCmi()[element] ?? ''
            if (value === undefined ? !current : current !== value) return false
          }
          return true
        }
        while (!met()) {
          if (Date.now() - started >= timeout) {
            const current = element ? useRuntimeStore.getState().adapter?.getFlattenedCmi()[element] : undefined
            return {
              met: false,
              error: `Not met within ${timeout} ms.`,
              ...(current !== undefined ? { currentValue: current } : {}),
            }
          }
          await delay(250, signal)
        }
        return { met: true, afterMs: Date.now() - started }
      },
    },
    {
      name: 'open_package_from_url',
      title: 'Open a package from a URL',
      description:
        'Download a SCORM .zip from a URL and open it in SCORMite, replacing the open package and its tracking data. The server must allow cross-origin downloads (CORS); otherwise ask the user to download the file and drop it on the page.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'An http(s) URL of a .zip' } },
        required: ['url'],
      },
      annotations: { consequentialHint: true },
      execute: async (input, { signal }) => {
        const session = host.session()
        if (session.loading) return { error: 'A package is already being opened.' }
        let url: URL
        try {
          url = new URL(string(input['url']) ?? '', location.href)
        } catch {
          return { error: 'url is not a valid URL.' }
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'url must be http(s).' }
        let response: Response
        try {
          response = await fetch(url, { signal })
        } catch {
          return {
            error:
              'The download failed — the server may not allow cross-origin requests (CORS). Ask the user to download the .zip and drop it on the page.',
          }
        }
        if (!response.ok) return { error: `The server answered ${response.status}.` }
        const bytes = await readBounded(response, MAX_PACKAGE_BYTES)
        if (!bytes) return { error: 'The package is too large to open from a URL.' }
        let name = url.pathname.split('/').pop() || 'package.zip'
        try {
          name = decodeURIComponent(name)
        } catch {
          // Keep the name as it is in the URL.
        }
        const before = usePackageStore.getState().package?.id
        await session.loadFile(
          new File([bytes], /\.zip$/i.test(name) ? name : `${name}.zip`, { type: 'application/zip' }),
        )
        const opened = usePackageStore.getState().package
        if (!opened || opened.id === before) {
          return { error: 'The file could not be opened as a SCORM package. Call get_session to see why.' }
        }
        return { opened: true, name: opened.name, scormVersion: opened.scormVersion }
      },
    },
    {
      name: 'close_package',
      title: 'Close the package',
      description: 'Close the open package and return to the drop zone, discarding its tracking data.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { consequentialHint: true },
      execute: async () => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        session.close()
        return { closed: true }
      },
    },
  ]
}
