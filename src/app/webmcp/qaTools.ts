/**
 * WebMCP tools for reviewing and testing a package end to end: a test plan
 * for this package, one-call audit, the manifest and the package's files, the
 * running page (read it, and operate it like a learner), the network and CMI
 * history, breakpoints, and the learner identity.
 *
 * Same conventions as tools.ts: JSON results, `{ error }` with what to do
 * instead, and `untrustedContentHint` on anything the package controls.
 */

import { useManifestStore } from '@/features/manifest'
import { usePackageStore } from '@/features/package-loader'
import { packageLaunchUrl, useNetworkStore } from '@/features/player'
import { useLogStore } from '@/features/logging'
import { useTimelineStore } from '@/features/timeline'
import { useValidationStore } from '@/features/validation'
import {
  describeBreakpoint,
  useBreakpointStore,
  validateBreakpointDraft,
  type BreakpointDraft,
} from '@/features/session'
import { learnerIdProblem, useLearnerStore } from '@/features/learner'
import { useCourseStore } from '@/app/state/courseStore'
import type { ScormApiMethod } from '@/shared/types'
import type { ModelContextTool } from './modelContext'
import type { ToolHost } from './tools'
import { auditSession, buildTestPlan } from './audit'
import { interactWithSco, readScoPage, scoDocument, type ScoAction } from './scoPage'

const NO_PACKAGE = { error: 'No package is open. Ask the user to drop a SCORM .zip on the SCORMite page.' }
const NO_PAGE = { error: 'No item is running. Use launch_item first.' }

const string = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const bounded = (value: unknown, fallback: number, max: number) =>
  Math.min(Math.max(Math.trunc(Number(value)) || fallback, 1), max)

/** The package path of a service-worker URL (`/scorm-files/{id}/a/b.js` → `a/b.js`). */
const packagePath = (url: string) => decodeURIComponent(url.replace(/^.*?\/scorm-files\/[^/]+\//, ''))

const TEXT_FILE = /\.(html?|xhtml|xml|xsd|js|mjs|cjs|json|css|txt|md|csv|svg|vtt|srt)$/i

const untrustedRead = { readOnlyHint: true, untrustedContentHint: true }

function missingFiles(): string[] {
  return useNetworkStore
    .getState()
    .entries.filter((entry) => entry.status === 404)
    .map((entry) => packagePath(entry.path))
}

export function createQaTools(host: ToolHost): ModelContextTool[] {
  return [
    {
      name: 'get_test_plan',
      title: 'Plan the testing of this package',
      description:
        'A step-by-step QA plan for the open package: for every item, what to do (take it to the end, test resume, test the failing path, check launch data), which tools to use, and what to check; plus sequencing, content review, and collecting the findings. Start here to test a package completely.',
      inputSchema: { type: 'object', properties: {} },
      annotations: untrustedRead,
      execute: async () => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const course = useCourseStore.getState()
        return buildTestPlan(course.items, session.pkg.scormVersion, course.sequenced)
      },
    },
    {
      name: 'audit_session',
      title: 'Check everything so far',
      description:
        'One structured check of the whole session: packaging and runtime validation issues, failed API calls (grouped), files the course requested that are missing, accessibility problems on the running page, and which items were launched, completed, passed, or failed — with suggested next steps.',
      inputSchema: { type: 'object', properties: {} },
      annotations: untrustedRead,
      execute: async () => {
        if (!host.session().pkg) return NO_PACKAGE
        const course = useCourseStore.getState()
        const page = scoDocument()
        return auditSession({
          items: course.items,
          progress: course.progress,
          issues: useValidationStore.getState().issues,
          apiCalls: useLogStore.getState().records,
          missingFiles: missingFiles(),
          pageAccessibility: page ? readScoPage(page).accessibility : null,
        })
      },
    },
    {
      name: 'get_manifest',
      title: 'Read the manifest',
      description:
        "The parsed imsmanifest.xml: metadata, organizations with their item tree (each item's resource, parameters, launch data such as mastery score or completion threshold, and whether it declares sequencing), and resources with their type, launch file, and file count.",
      inputSchema: { type: 'object', properties: {} },
      annotations: untrustedRead,
      execute: async () => {
        const manifest = useManifestStore.getState().manifest
        if (!host.session().pkg || !manifest) return NO_PACKAGE
        type Item = (typeof manifest.organizations)[number]['items'][number]
        const item = (node: Item): Record<string, unknown> => ({
          id: node.identifier,
          title: node.title,
          ...(node.identifierref ? { resource: node.identifierref } : {}),
          ...(node.isvisible ? {} : { visible: false }),
          ...(node.parameters ? { parameters: node.parameters } : {}),
          ...(node.launchData && Object.keys(node.launchData).length ? { launchData: node.launchData } : {}),
          ...(node.sequencing ? { sequencing: true } : {}),
          ...(node.children.length ? { children: node.children.map(item) } : {}),
        })
        return {
          metadata: manifest.metadata,
          defaultOrganization: manifest.defaultOrganizationIdentifier ?? null,
          organizations: manifest.organizations.map((org) => ({
            id: org.identifier,
            title: org.title,
            items: org.items.map(item),
          })),
          resources: manifest.resources.map((resource) => ({
            id: resource.identifier,
            type: resource.type,
            scormType: resource.scormType ?? null,
            href: resource.href ?? null,
            files: resource.files.length,
          })),
        }
      },
    },
    {
      name: 'list_files',
      title: 'List the package files',
      description:
        'Every file in the package zip, with launch files marked, and files the manifest declares that are missing from the zip. Optionally only paths starting with a prefix.',
      inputSchema: {
        type: 'object',
        properties: { prefix: { type: 'string', description: 'Only paths starting with this, e.g. "assets/"' } },
      },
      annotations: untrustedRead,
      execute: async (input) => {
        const manifest = useManifestStore.getState().manifest
        if (!host.session().pkg || !manifest) return NO_PACKAGE
        const prefix = string(input['prefix']) ?? ''
        const files = usePackageStore.getState().filePaths
        const present = new Set(files)
        const launch = new Set(manifest.resources.map((r) => r.href?.split(/[?#]/)[0]).filter(Boolean))
        const declared = manifest.resources.flatMap((r) => r.files)
        return {
          total: files.length,
          files: files
            .filter((path) => path.startsWith(prefix))
            .map((path) => (launch.has(path) ? { path, launch: true } : { path })),
          declaredButMissing: [...new Set(declared.filter((path) => !present.has(path)))],
        }
      },
    },
    {
      name: 'read_file',
      title: 'Read a package file',
      description:
        'The text of a file in the package (HTML, JavaScript, CSS, XML, JSON, captions, …) for content and code review. Binary files (images, media, fonts) return their type and size only. Paths come from list_files.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path inside the package, from list_files' },
          maxChars: { type: 'integer', minimum: 1, maximum: 200000, description: 'Default 20000' },
        },
        required: ['path'],
      },
      annotations: untrustedRead,
      execute: async (input, { signal }) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const path = string(input['path'])?.replace(/^\/+/, '')
        if (!path || !usePackageStore.getState().filePaths.includes(path)) {
          return { error: `"${path ?? ''}" is not in the package. Use a path from list_files.` }
        }
        const response = await fetch(packageLaunchUrl(session.pkg.id, path), { signal })
        if (!response.ok) return { error: `The file could not be read (HTTP ${response.status}).` }
        const type = response.headers.get('content-type') ?? ''
        if (!TEXT_FILE.test(path) && !/^text\/|json|xml|javascript|svg/.test(type)) {
          const size = (await response.blob()).size
          return { path, binary: true, contentType: type, bytes: size }
        }
        const text = await response.text()
        const maxChars = bounded(input['maxChars'], 20000, 200000)
        return {
          path,
          contentType: type,
          chars: text.length,
          truncated: text.length > maxChars,
          text: text.slice(0, maxChars),
        }
      },
    },
    {
      name: 'read_sco_page',
      title: 'Read the running page',
      description:
        "What the learner sees on the running item's page: title, language, visible text, headings, images with alt text, and every interactive control with a ref to use in interact_with_sco, plus accessibility problems (missing alt text, unnamed controls, no language). Call it again after interacting — the page changes.",
      inputSchema: {
        type: 'object',
        properties: {
          maxChars: { type: 'integer', minimum: 1, maximum: 50000, description: 'Text length, default 8000' },
        },
      },
      annotations: untrustedRead,
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const page = scoDocument()
        if (!page?.body) return NO_PAGE
        return readScoPage(page, bounded(input['maxChars'], 8000, 50000))
      },
    },
    {
      name: 'interact_with_sco',
      title: 'Operate the running page',
      description:
        'Act on the running page like a learner: click a button or link, type into a field, choose an option, or check / uncheck a box — identified by a ref from read_sco_page. Use it to work through lessons and quizzes, then read the page or get_cmi to see the effect.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Control ref from read_sco_page, e.g. "e3"' },
          action: { type: 'string', enum: ['click', 'type', 'select', 'check', 'uncheck'] },
          value: { type: 'string', description: 'Text to type, or the option to select (value or label)' },
        },
        required: ['ref', 'action'],
      },
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const page = scoDocument()
        if (!page) return NO_PAGE
        const ref = string(input['ref'])
        if (!ref) return { error: 'ref is required; take it from read_sco_page.' }
        const problem = interactWithSco(page, ref, input['action'] as ScoAction, string(input['value']) ?? '')
        return problem ? { error: problem } : { done: true, note: 'Call read_sco_page to see the page now.' }
      },
    },
    {
      name: 'get_network',
      title: 'List the files the course requested',
      description:
        'Every package file the running course requested, with whether it was found in the package (status 200) or missing (404). Optionally only the missing ones.',
      inputSchema: {
        type: 'object',
        properties: {
          missingOnly: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Most recent requests, default 100' },
        },
      },
      annotations: untrustedRead,
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const entries = useNetworkStore.getState().entries
        const selected = (input['missingOnly'] === true ? entries.filter((e) => e.status === 404) : entries).slice(
          -bounded(input['limit'], 100, 500),
        )
        return {
          total: entries.length,
          missing: entries.filter((e) => e.status === 404).length,
          requests: selected.map((e) => ({
            path: packagePath(e.path),
            status: e.status,
            ms: Math.round(e.durationMs),
          })),
        }
      },
    },
    {
      name: 'get_cmi_changes',
      title: 'Read how the CMI data changed',
      description:
        "The running item's data-model changes over time, oldest first: at each API call that changed something, which elements changed and their new values. Use it to check the order and logic of what the course reports. Optionally only elements starting with a prefix.",
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Only elements starting with this, e.g. "cmi.interactions"' },
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Most recent changes, default 100' },
        },
      },
      annotations: untrustedRead,
      execute: async (input) => {
        if (!host.session().pkg) return NO_PACKAGE
        const prefix = string(input['prefix']) ?? ''
        const changes = useTimelineStore
          .getState()
          .snapshots.map((snapshot) => ({
            time: new Date(snapshot.timestamp).toISOString(),
            changes: Object.fromEntries(
              snapshot.changedPaths.filter((p) => p.startsWith(prefix)).map((p) => [p, snapshot.data[p] ?? '']),
            ),
          }))
          .filter((entry) => Object.keys(entry.changes).length > 0)
        return { total: changes.length, changes: changes.slice(-bounded(input['limit'], 100, 500)) }
      },
    },
    {
      name: 'manage_breakpoints',
      title: 'Manage breakpoints',
      description:
        'Hold SCORM API calls to inspect the data before they apply. action "list" shows breakpoints and whether a call is held; "add" creates one (kind "api-call" with a method; "cmi-set" with an element and optional value; "score-threshold" with a threshold; "objective-update"); "remove" by id; "clear" removes all; "resume" applies the held calls in order.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'remove', 'clear', 'resume'] },
          kind: { type: 'string', enum: ['api-call', 'cmi-set', 'score-threshold', 'objective-update'] },
          method: { type: 'string', enum: ['SetValue', 'Commit'] },
          element: { type: 'string', description: 'CMI element, e.g. cmi.core.lesson_status' },
          value: { type: 'string', description: 'Only SetValue calls with this value (cmi-set)' },
          threshold: { type: 'number', description: 'Score at or above which to hold (score-threshold)' },
          id: { type: 'string', description: 'Breakpoint id (remove)' },
        },
        required: ['action'],
      },
      execute: async (input) => {
        const store = useBreakpointStore.getState()
        const list = () => {
          const state = useBreakpointStore.getState()
          return {
            paused: state.paused,
            ...(state.currentHit ? { heldCall: state.currentHit } : {}),
            breakpoints: state.breakpoints.map((bp) => ({
              id: bp.id,
              kind: bp.kind,
              matches: describeBreakpoint(bp),
              enabled: bp.enabled,
              hits: bp.hitCount,
            })),
          }
        }
        switch (input['action']) {
          case 'list':
            return list()
          case 'add': {
            const draft: BreakpointDraft = { kind: input['kind'] as BreakpointDraft['kind'] }
            const method = string(input['method'])
            const element = string(input['element'])
            const value = string(input['value'])
            if (method) draft.method = method as ScormApiMethod
            if (element) draft.element = element
            if (value !== undefined) draft.value = value
            if (typeof input['threshold'] === 'number') draft.threshold = input['threshold']
            const problem = validateBreakpointDraft(draft)
            if (problem) return { error: problem }
            store.addBreakpoint(draft)
            return list()
          }
          case 'remove':
            if (!store.breakpoints.some((bp) => bp.id === input['id']))
              return { error: 'No breakpoint with that id; use list.' }
            store.removeBreakpoint(String(input['id']))
            return list()
          case 'clear':
            store.clearBreakpoints()
            return list()
          case 'resume':
            if (!store.paused) return { error: 'No call is held.' }
            store.resume()
            return list()
          default:
            return { error: 'action must be list, add, remove, clear, or resume.' }
        }
      },
    },
    {
      name: 'set_learner',
      title: 'Set the learner',
      description:
        'The learner ID and name courses receive (cmi.core.student_id / student_name in SCORM 1.2, cmi.learner_id / learner_name in 2004). Applies from the next launch — relaunch the item to see it.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string', description: 'Usually "Last, First"' } },
        required: ['id', 'name'],
      },
      execute: async (input) => {
        const id = string(input['id']) ?? ''
        const name = string(input['name']) ?? ''
        const problem = learnerIdProblem(id) ?? (id.trim() && name.trim() ? null : 'Both id and name are required.')
        if (problem) return { error: problem }
        useLearnerStore.getState().setLearner({ id, name })
        return { learner: { id: id.trim(), name: name.trim() }, note: 'Applies from the next launch.' }
      },
    },
  ]
}
