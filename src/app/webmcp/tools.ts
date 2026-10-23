/**
 * SCORMite's WebMCP tools: what an AI agent in the user's browser can read
 * from and do with the open package — the same session the user sees.
 *
 * Results are plain JSON-serializable objects; the browser serializes them
 * for the agent. Preconditions are checked when a tool runs (the session may
 * have changed since the agent read the schema) and reported as `{ error }`
 * with what to do instead, so the agent can correct itself.
 *
 * Everything a package controls — titles, CMI values, API arguments, manifest
 * text — is third-party content, so tools that return it carry
 * `untrustedContentHint`. Tools that discard tracking data carry
 * `consequentialHint`, letting the browser confirm with the user.
 */

import { ReportBuilderService } from '@/features/reports'
import { useLogStore } from '@/features/logging'
import { useRuntimeStore } from '@/features/runtime'
import { useValidationStore } from '@/features/validation'
import { useCourseStore, type NavigationIntent } from '@/app/state/courseStore'
import { buildCurrentReport } from '@/app/hooks/useReportExport'
import type { PackageSession } from '@/app/hooks/usePackageSession'
import type { AppMode } from '@/app/state/appModeStore'
import type { ModelContextTool } from './modelContext'
import { createQaTools } from './qaTools'
import { createContentTools } from './contentTools'
import { createSecurityTools } from './securityTools'
import { createAutomationTools } from './automationTools'

/** What the tools need from the React side of the app. */
export interface ToolHost {
  /** The current package session (read at call time). */
  session: () => PackageSession
  mode: () => AppMode
  setMode: (mode: AppMode) => void
  /** Advanced mode needs a desktop-width window. */
  advancedAvailable: () => boolean
}

type ToolResult = Record<string, unknown>

const NO_PACKAGE = { error: 'No package is open. Ask the user to drop a SCORM .zip on the SCORMite page.' }

function busy(): boolean {
  const course = useCourseStore.getState()
  return course.pendingLaunch !== null || course.pendingNavigation !== null
}

const BUSY = { error: 'A launch or navigation is in progress. Call get_session again in a moment.' }

/** The session as the outline shows it. */
export function describeSession(host: ToolHost): ToolResult {
  const session = host.session()
  const course = useCourseStore.getState()
  const runtime = useRuntimeStore.getState()
  if (!session.pkg) {
    return { open: false, loading: session.loading, error: session.error, mode: host.mode() }
  }
  const { navigation } = course
  return {
    open: true,
    mode: host.mode(),
    advancedModeAvailable: host.advancedAvailable(),
    package: {
      name: session.pkg.name,
      scormVersion: session.pkg.scormVersion,
      ...(session.pkg.scormEdition ? { scormEdition: session.pkg.scormEdition } : {}),
    },
    sequenced: course.sequenced,
    currentItemId: course.currentItemId,
    busy: busy(),
    courseEnded: course.endedReason,
    runtime: { initialized: runtime.isInitialized, terminated: runtime.isTerminated },
    navigation: { canPrevious: navigation.canPrevious, canNext: navigation.canContinue },
    items: course.items.map((item) => {
      const summary = course.progress[item.identifier]
      return {
        id: item.identifier,
        title: item.title,
        type: item.scormType,
        current: item.identifier === course.currentItemId,
        // As the outline: sequencing rules may forbid choosing an item now.
        allowed:
          item.identifier === course.currentItemId ||
          navigation.choices === null ||
          navigation.choices.includes(item.identifier),
        completionStatus: summary?.completionStatus ?? 'not attempted',
        successStatus: summary?.successStatus ?? 'unknown',
        score: summary?.score ?? '',
      }
    }),
  }
}

function go(intent: NavigationIntent): ToolResult {
  useCourseStore.getState().go(intent)
  return { requested: true, note: 'The launch happens asynchronously; call get_session to see the result.' }
}

const string = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

export function createScormiteTools(host: ToolHost): ModelContextTool[] {
  const sessionTools: ModelContextTool[] = [
    {
      name: 'get_session',
      title: 'Get the SCORM session',
      description:
        'The SCORM package open in SCORMite: name and SCORM version, the course items with their completion, success, and score, which item is running, whether each item may be chosen now (SCORM 2004 sequencing), and whether Previous / Next are allowed.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => describeSession(host),
    },
    {
      name: 'get_cmi',
      title: 'Read the CMI data model',
      description:
        'The running item\'s SCORM data model (CMI) as flat "element": "value" pairs, e.g. cmi.core.lesson_status or cmi.completion_status. Optionally only the elements starting with a prefix.',
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Only elements starting with this, e.g. "cmi.objectives"' },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const adapter = useRuntimeStore.getState().adapter
        if (!adapter) return { error: 'No item is running yet. Call get_session, then launch_item.' }
        const prefix = string(input['prefix']) ?? ''
        const cmi = Object.fromEntries(
          Object.entries(adapter.getFlattenedCmi()).filter(([key]) => key.startsWith(prefix)),
        )
        return { scormVersion: useRuntimeStore.getState().scormVersion, elements: cmi }
      },
    },
    {
      name: 'get_api_log',
      title: 'Read the SCORM API log',
      description:
        "The SCORM API calls the course made (Initialize, GetValue, SetValue, Commit, Terminate…), newest last, with arguments, results, and for failed calls the SCORM error code and the runtime's explanation.",
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Most recent calls to return (default 50)' },
          failedOnly: { type: 'boolean', description: 'Only calls that returned an error' },
        },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const limit = Math.min(Math.max(Number(input['limit']) || 50, 1), 500)
        const records = useLogStore.getState().records
        const selected = (input['failedOnly'] === true ? records.filter((r) => r.errorCode) : records).slice(-limit)
        return {
          total: records.length,
          calls: selected.map((r) => ({
            time: new Date(r.timestamp).toISOString(),
            method: r.method,
            ...(r.element !== undefined ? { element: r.element } : {}),
            ...(r.value !== undefined ? { value: r.value } : {}),
            result: r.returnValue,
            ...(r.errorCode ? { errorCode: r.errorCode, error: r.errorString, diagnostic: r.diagnostic } : {}),
          })),
        }
      },
    },
    {
      name: 'get_validation_issues',
      title: 'List validation issues',
      description:
        'Problems SCORMite found in the package (missing files, broken references, manifest not at the zip root, …) and while it ran (out-of-range scores, oversized suspend data, missing commits, a status the LMS rules changed, refused navigation).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => {
        if (!host.session().pkg) return NO_PACKAGE
        return {
          issues: useValidationStore.getState().issues.map((issue) => ({
            severity: issue.severity,
            rule: issue.ruleId,
            source: issue.source,
            message: issue.message,
            ...(issue.location ? { location: issue.location } : {}),
          })),
        }
      },
    },
    {
      name: 'get_report',
      title: 'Build the QA report',
      description:
        "The full QA report of the session — package summary, each item's result, runtime summary, validation issues, the API log, and data changes — as Markdown (readable) or JSON (structured).",
      inputSchema: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['markdown', 'json'], description: 'Default markdown' } },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        const report = buildCurrentReport()
        if (!report) return NO_PACKAGE
        return input['format'] === 'json'
          ? { format: 'json', report: JSON.parse(ReportBuilderService.serializeJson(report)) as unknown }
          : { format: 'markdown', report: ReportBuilderService.serializeMarkdown(report) }
      },
    },
    {
      name: 'launch_item',
      title: 'Launch a course item',
      description:
        'Launch an item of the course (an id from get_session), as a learner choosing it in the outline. Resumes its saved attempt like an LMS. SCORM 2004 sequencing rules may forbid the choice; get_session says which items are allowed.',
      inputSchema: {
        type: 'object',
        properties: { itemId: { type: 'string', description: 'Item id from get_session' } },
        required: ['itemId'],
      },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        if (busy()) return BUSY
        const itemId = string(input['itemId'])
        const course = useCourseStore.getState()
        if (!itemId || !course.items.some((item) => item.identifier === itemId)) {
          return { error: `Unknown item "${itemId ?? ''}". Use an id from get_session.` }
        }
        const { choices } = course.navigation
        if (itemId !== course.currentItemId && choices !== null && !choices.includes(itemId)) {
          return { error: `The course's sequencing rules do not allow choosing "${itemId}" now.` }
        }
        return go({ request: 'choice', targetId: itemId, mode: 'resume' })
      },
    },
    {
      name: 'navigate',
      title: 'Go to the next or previous item',
      description:
        "Move through the course like the Previous / Next buttons. In SCORM 2004 the course's sequencing rules decide; get_session says whether each direction is allowed.",
      inputSchema: {
        type: 'object',
        properties: { direction: { type: 'string', enum: ['next', 'previous'] } },
        required: ['direction'],
      },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        if (busy()) return BUSY
        const direction = input['direction']
        const { navigation } = useCourseStore.getState()
        if (direction === 'next') {
          return navigation.canContinue
            ? go({ request: 'continue', mode: 'resume' })
            : { error: 'Next is not allowed now.' }
        }
        if (direction === 'previous') {
          return navigation.canPrevious
            ? go({ request: 'previous', mode: 'resume' })
            : { error: 'Previous is not allowed now.' }
        }
        return { error: 'direction must be "next" or "previous".' }
      },
    },
    {
      name: 'relaunch_item',
      title: 'Relaunch the current item',
      description:
        'Reload the running item the way an LMS does, resuming from its saved data (suspend data, location, entry=resume after a suspend exit). Use it to test resume behaviour.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        if (busy()) return BUSY
        if (!session.currentItem) return { error: 'No item is running. Use launch_item first.' }
        session.relaunch()
        return { requested: true, note: 'Relaunching; call get_session or get_cmi to see the result.' }
      },
    },
    {
      name: 'discard_and_restart',
      title: 'Start over without saved data',
      description:
        'Discard saved tracking data and start fresh: scope "item" starts a new attempt of the running item; scope "course" discards every item\'s data and restarts the course from the beginning. This deletes the saved progress.',
      inputSchema: {
        type: 'object',
        properties: { scope: { type: 'string', enum: ['item', 'course'] } },
        required: ['scope'],
      },
      annotations: { consequentialHint: true },
      execute: async (input) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        if (busy()) return BUSY
        if (input['scope'] === 'item') {
          if (!session.currentItem) return { error: 'No item is running. Use launch_item first.' }
          session.newAttempt()
        } else if (input['scope'] === 'course') {
          session.restartCourse()
        } else {
          return { error: 'scope must be "item" or "course".' }
        }
        return { requested: true, note: 'Restarting; call get_session to see the result.' }
      },
    },
    {
      name: 'set_view_mode',
      title: 'Switch Basic / Advanced mode',
      description:
        'Switch SCORMite between Basic mode (outline, status, API log) and Advanced mode (dockable panels: manifest, CMI inspector, API log, validation, network…). The running course is not interrupted.',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['basic', 'advanced'] } },
        required: ['mode'],
      },
      execute: async (input) => {
        const mode = input['mode']
        if (mode !== 'basic' && mode !== 'advanced') return { error: 'mode must be "basic" or "advanced".' }
        if (mode === 'advanced' && !host.advancedAvailable()) {
          return { error: 'Advanced mode needs a window at least 1024 px wide.' }
        }
        host.setMode(mode)
        return { mode }
      },
    },
  ]
  return [
    ...sessionTools,
    ...createQaTools(host),
    ...createContentTools(host),
    ...createSecurityTools(host),
    ...createAutomationTools(host),
  ]
}
