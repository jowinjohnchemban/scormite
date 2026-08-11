# SCORMite — Milestone 1: Architecture & Design

**Status:** Foundational design milestone (no application code yet — this is the blueprint the code will be built against). Nothing below "compiles" because nothing is code; the exit criterion for this milestone is that the design is internally consistent and unambiguous enough that Milestone 2 (project scaffold) can be built from it without re-litigating decisions.

---

## 1. Complete Architecture

### 1.1 Layered architecture (confirmed)

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React)                                            │
│  - Basic Mode shell, Advanced Mode shell                     │
│  - Feature components (read from stores, dispatch commands)  │
├─────────────────────────────────────────────────────────────┤
│  Studio Services Layer                                       │
│  - Package Service, Manifest Service, Validation Service     │
│  - Report Service, Profile Service, Plugin Host, Storage Svc │
│  - Pure application logic — no React, no DOM                 │
├─────────────────────────────────────────────────────────────┤
│  Runtime Adapter Layer                                       │
│  - ScormRuntimeAdapter (interface + SCORM 1.2 / 2004 impls)  │
│  - Middleware pipeline (record, validate, breakpoint, replay)│
│  - Event bus (RuntimeEventEmitter)                            │
├─────────────────────────────────────────────────────────────┤
│  scorm-again (vendored dependency, never modified)            │
├─────────────────────────────────────────────────────────────┤
│  SCORM Package (iframe-sandboxed content, ZIP/folder source)  │
└─────────────────────────────────────────────────────────────┘
```

**Rule enforced by this architecture:** nothing above the Runtime Adapter layer is allowed to import from `scorm-again` directly. The adapter is the only file group with that import right. This is enforced at lint-time in Milestone 2 via an ESLint `no-restricted-imports` rule scoped per folder — not just a convention.

### 1.2 Data flow (a single `SetValue` call, end to end)

```
SCORM package (iframe)
  → window.API / window.API_1484_11 (scorm-again's injected API)
    → scorm-again internal handler
      → RuntimeAdapter middleware pipeline (pre-hooks: breakpoint check)
        → scorm-again.SetValue(element, value)
          → middleware pipeline (post-hooks: record, snapshot, validate, timeline, replay-log)
            → RuntimeEventEmitter.emit('cmi:set', event)
              → Zustand stores subscribed to the event bus update
                → React re-renders CMI Inspector, API Monitor, Timeline
```

Every call is intercepted twice: once before it reaches scorm-again (for breakpoints, which must be able to *pause before* the call completes) and once after (for everything that only needs the result).

### 1.3 Cross-cutting concerns

| Concern | Where it lives |
|---|---|
| Logging/telemetry capture | Runtime Adapter middleware, always-on, in-memory ring buffer |
| Persistence (sessions, settings, layout) | Studio Services → IndexedDB (via a thin `StorageService`, not raw `idb` calls scattered around) |
| Plugin registration | Plugin Host in Studio Services; UI queries it for panels/commands to render |
| Feature flags / mode switching (Basic ↔ Advanced) | A single `useAppMode` store; components read it, never branch on `window.location` or similar |
| Error boundaries | One per dockable panel, so a broken panel doesn't crash the whole IDE |

---

## 2. Folder Structure

```
scormite/
├── src/
│   ├── app/                          # App shell, routing, mode switch, providers
│   │   ├── App.tsx
│   │   ├── AppProviders.tsx
│   │   ├── modes/
│   │   │   ├── BasicModeShell.tsx
│   │   │   └── AdvancedModeShell.tsx
│   │   └── layout/                   # Dockable layout engine (top/left/center/right/bottom)
│   │       ├── DockLayout.tsx
│   │       ├── PanelRegistry.ts
│   │       └── useLayoutPersistence.ts
│   │
│   ├── features/
│   │   ├── runtime/                  # Owns the RuntimeAdapter + scorm-again wiring
│   │   │   ├── adapter/
│   │   │   │   ├── ScormRuntimeAdapter.ts
│   │   │   │   ├── Scorm12Adapter.ts
│   │   │   │   ├── Scorm2004Adapter.ts
│   │   │   │   └── middleware/
│   │   │   │       ├── recordingMiddleware.ts
│   │   │   │       ├── breakpointMiddleware.ts
│   │   │   │       ├── validationMiddleware.ts
│   │   │   │       └── replayMiddleware.ts
│   │   │   ├── events/RuntimeEventEmitter.ts
│   │   │   ├── state/runtimeStore.ts
│   │   │   ├── types/
│   │   │   ├── hooks/
│   │   │   └── tests/
│   │   │
│   │   ├── manifest/                 # imsmanifest.xml parsing + tree model
│   │   │   ├── services/ManifestParserService.ts   (fast-xml-parser based)
│   │   │   ├── components/ManifestExplorer.tsx
│   │   │   ├── state/manifestStore.ts
│   │   │   ├── types/
│   │   │   └── tests/
│   │   │
│   │   ├── player/                   # Sandboxed iframe player
│   │   │   ├── components/PlayerFrame.tsx
│   │   │   ├── components/PlayerToolbar.tsx  (reload, fullscreen, viewport presets)
│   │   │   ├── services/PlayerBridgeService.ts
│   │   │   └── tests/
│   │   │
│   │   ├── validation/               # Static + runtime validators
│   │   │   ├── validators/manifestValidators.ts
│   │   │   ├── validators/runtimeValidators.ts
│   │   │   ├── components/ValidationPanel.tsx
│   │   │   ├── state/validationStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── timeline/                 # Event timeline + replay/scrub UI
│   │   │   ├── components/TimelinePanel.tsx
│   │   │   ├── components/ReplayControls.tsx
│   │   │   ├── state/timelineStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── logging/                  # API Monitor + Console + export
│   │   │   ├── components/ApiMonitorPanel.tsx
│   │   │   ├── components/ConsolePanel.tsx
│   │   │   ├── services/LogExportService.ts   (JSON/CSV/MD/HTML)
│   │   │   ├── state/logStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── session/                  # Session lifecycle, snapshots, breakpoints
│   │   │   ├── services/SessionService.ts
│   │   │   ├── services/BreakpointService.ts
│   │   │   ├── components/BreakpointsPanel.tsx
│   │   │   ├── state/sessionStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── inspector/                # CMI Inspector (tree, diff, edit)
│   │   │   ├── components/CmiInspector.tsx
│   │   │   ├── components/CmiDiffView.tsx
│   │   │   ├── state/inspectorStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── settings/                 # Runtime profiles, app settings, theme
│   │   │   ├── profiles/ (StrictAdl.ts, ScormCloud.ts, Moodle.ts, ...)
│   │   │   ├── components/SettingsPanel.tsx
│   │   │   ├── state/settingsStore.ts
│   │   │   └── tests/
│   │   │
│   │   ├── reports/                  # One-click QA report generation
│   │   │   ├── services/ReportBuilderService.ts
│   │   │   ├── templates/
│   │   │   └── tests/
│   │   │
│   │   ├── package-loader/           # ZIP/folder ingestion, JSZip, SCORM version sniffing
│   │   │   ├── services/PackageLoaderService.ts
│   │   │   ├── services/PackageDetectionService.ts
│   │   │   ├── components/DropZone.tsx
│   │   │   └── tests/
│   │   │
│   │   └── plugins/                  # Plugin host + built-in plugin scaffolds
│   │       ├── PluginHost.ts
│   │       ├── PluginApi.ts          (the contract 3rd-party/future plugins implement)
│   │       ├── registry/PluginRegistry.ts
│   │       └── builtin/ (xapi/, cmi5/, accessibility/, ai-review/ — stubs, disabled)
│   │
│   ├── components/                   # Shared, dumb, cross-feature UI (shadcn wrappers, icons)
│   ├── shared/                       # Cross-feature utilities, types, constants
│   │   ├── lib/
│   │   ├── types/
│   │   └── testing/                  # Shared test utilities/fixtures
│   │
│   └── main.tsx
│
├── e2e/                               # Playwright specs
├── public/
├── docs/                              # ADRs, this design doc, generated API docs
└── package.json
```

**Ownership rule:** a feature folder may import from `shared/`, `components/`, and its own subtree freely. Feature-to-feature imports are only allowed through a feature's `index.ts` public surface (barrel export) — never reaching into another feature's internals. This is what keeps "feature-first" from decaying into a tangle over time.

---

## 3. Technical Design Notes

- **Why scorm-again stays untouched:** it's the compatibility-critical piece. Any local patch becomes a merge-conflict liability against upstream and a compatibility risk against SCORM Cloud (the stated benchmark). All customization happens through the adapter/middleware, which is designed specifically so nothing SCORMite-specific ever needs to live inside scorm-again.
- **Why middleware, not subclassing:** scorm-again exposes an API-call surface (Initialize/GetValue/SetValue/Commit/Finish/Terminate). Wrapping that surface with a pipeline of pre/post hooks (breakpoint → call → record → validate → emit) is more composable than subclassing, and it's how new capabilities (e.g., a future "throttle simulator" middleware) get added without touching existing middleware.
- **Why Zustand over Redux:** many small, feature-owned stores map cleanly onto the feature-first folder structure; no single global reducer to coordinate across 15+ panels. Cross-store reads happen via selectors, not shared reducers.
- **Why the event bus is separate from the stores:** the middleware layer has no React dependency and must be usable/testable headlessly (e.g., in a future CLI or Playwright fixture that drives a package with no UI at all). Stores subscribe to the bus; they don't own it.
- **Iframe sandboxing:** the player iframe runs with `sandbox="allow-scripts allow-same-origin allow-forms"` (same-origin is required for scorm-again's API injection to work, which is a known trade-off — mitigated by strict CSP on the shell and by never loading remote package URLs, only local blob URLs from the loaded ZIP/folder).

---

## 4. Domain Model

Core entities (TypeScript-flavored, not full code — this is the model Milestone 2 will implement):

```
Package
  id, name, sourceType: 'zip' | 'folder'
  scormVersion: '1.2' | '2004' (2nd|3rd|4th ed.)
  manifest: Manifest
  launchUrl: string
  resources: Resource[]
  loadedAt: DateTime

Manifest
  organizations: Organization[]
  resources: Resource[]
  metadata: Metadata
  sequencing?: SequencingRules      # 2004 only
  validationIssues: ValidationIssue[]

Session
  id, packageId
  startedAt, endedAt?
  profile: RuntimeProfile           # e.g. 'strict-adl' | 'scorm-cloud' | 'moodle' | custom
  cmiSnapshots: CmiSnapshot[]       # for replay/diff
  apiCalls: ApiCallRecord[]
  events: TimelineEvent[]
  breakpoints: Breakpoint[]
  finalState: { completion, success, score, objectives, interactions }

ApiCallRecord
  id, sessionId, timestamp
  method: 'Initialize'|'Terminate'|'GetValue'|'SetValue'|'Commit'|'GetLastError'|...
  element?: string                  # CMI data model element, when applicable
  argument?: unknown
  returnValue: unknown
  durationMs: number
  errorCode?: string
  stackAtCall?: string              # captured for the Console/debugging panels

CmiSnapshot
  timestamp, sessionId
  data: Record<string, unknown>     # full CMI tree at this point
  changedPaths: string[]            # diff against previous snapshot

TimelineEvent
  id, sessionId, timestamp
  kind: 'lifecycle' | 'cmi-change' | 'navigation' | 'sequencing' | 'error'
  payload: unknown

ValidationIssue
  id, severity: 'error' | 'warning' | 'suggestion'
  source: 'manifest' | 'runtime'
  message, location?, ruleId

Breakpoint
  id, kind: 'api-call' | 'cmi-set' | 'score-threshold' | 'objective-update'
  condition: <kind-specific predicate>
  enabled: boolean

RuntimeProfile
  id: 'strict-adl' | 'scorm-cloud' | 'moodle' | 'canvas' | 'successfactors' | 'cornerstone' | 'custom'
  overrides: Partial<ScormAgainConfig>   # how this profile configures scorm-again + middleware behavior

Plugin
  id, name, version
  contributes: { panels?, commands?, menus?, inspectorTabs?, validators?, timelineEventTypes? }
```

---

## 5. UI Wireframes

### 5.1 Basic Mode

```
┌───────────────────────────────────────────────────────────────┐
│ SCORMite            [Basic ▾]        Open Package     Export  │
├───────────────────────────────────────────────────────────────┤
│                        │                                       │
│                        │        ┌─────────────────────┐        │
│   Package: my-course   │        │                     │        │
│   Version: SCORM 1.2   │        │   Player (iframe)   │        │
│                        │        │                     │        │
│   Progress: 62%        │        │                     │        │
│   Score:    82/100     │        └─────────────────────┘        │
│   Status:  Incomplete  │        [Reload] [Fullscreen] [Reset]  │
│                        │                                       │
│   Objectives (3/5) ▸   │                                       │
│   Interactions (12) ▸  │                                       │
│                        │                                       │
│   [Export Report]      │                                       │
└───────────────────────────────────────────────────────────────┘
```
No developer panels. No dockable layout — fixed two-column layout to keep it simple for the non-technical audience.

### 5.2 Advanced Mode

```
┌────────────────────────────────────────────────────────────────────┐
│  SCORMite  [Advanced ▾]  File Edit View Run Plugins   ⚙ Profile ▾ │
├───────────┬────────────────────────────────────┬───────────────────┤
│ Package   │                                    │  CMI Inspector    │
│ Explorer  │            Player (iframe)         │  ▸ cmi.core       │
│           │                                    │    score.raw: 82  │
│ ▸ manifest│                                    │  ▸ cmi.objectives │
│ ▸ res/    │                                    │  ▸ cmi.interactions│
│ ▸ scos/   │                                    │  [diff] [search]  │
├───────────┴────────────────────────────────────┴───────────────────┤
│ [API Monitor] [Timeline] [Validation] [Console] [Network] [Storage] │
│ [Performance] [Events] [Session Replay] [Breakpoints] [Plugins]     │
│ ───────────────────────────────────────────────────────────────── │
│ Time     Method     Element              Value    Dur   Result     │
│ 00:01.2  SetValue   cmi.core.score.raw   82       1ms   true       │
│ 00:01.2  Commit     -                    -        4ms   true       │
│ ...                                                                │
└───────────────────────────────────────────────────────────────────┘
```
Bottom panel is a tab strip (VS Code Terminal-panel style); left/right/bottom are all independently resizable and dockable, with layout persisted per-workspace.

---

## 6. Component Hierarchy (top levels)

```
<App>
 ├─ <AppProviders> (Zustand context not needed, but Theme/Query/ErrorBoundary providers live here)
 └─ <AppMode>
     ├─ <BasicModeShell>
     │   ├─ <PackageSummaryPanel>
     │   ├─ <PlayerFrame>
     │   └─ <ExportReportButton>
     │
     └─ <AdvancedModeShell>
         ├─ <TopToolbar>
         ├─ <DockLayout>
         │   ├─ region="left"   → <PackageExplorer> | <ManifestExplorer>
         │   ├─ region="center" → <PlayerFrame> + <PlayerToolbar>
         │   ├─ region="right"  → <CmiInspector> | <ValidationPanel>
         │   └─ region="bottom" → <PanelTabs>
         │       ├─ <ApiMonitorPanel>
         │       ├─ <TimelinePanel>
         │       ├─ <ValidationPanel>
         │       ├─ <ConsolePanel>
         │       ├─ <NetworkPanel>
         │       ├─ <StoragePanel>
         │       ├─ <PerformancePanel>
         │       ├─ <EventsPanel>
         │       ├─ <SessionReplayPanel>
         │       ├─ <BreakpointsPanel>
         │       └─ <PluginManagerPanel>
         └─ <StatusBar>
```

Every panel component is registered with `PanelRegistry` rather than hard-imported into `DockLayout` — plugins add panels the same way built-ins do.

---

## 7. State Architecture

One Zustand store per feature, no monolithic root store:

| Store | Owns |
|---|---|
| `packageStore` | loaded Package, load/parse status |
| `manifestStore` | parsed Manifest tree, selected node |
| `runtimeStore` | current Session, live CMI state, adapter connection status |
| `logStore` | ApiCallRecord[] (ring-buffered), console lines |
| `timelineStore` | TimelineEvent[], replay cursor position |
| `validationStore` | ValidationIssue[], last run timestamp |
| `sessionStore` | Session metadata, CmiSnapshot[] |
| `breakpointStore` | Breakpoint[], paused state |
| `settingsStore` | active RuntimeProfile, theme, editor prefs (persisted to IndexedDB) |
| `layoutStore` | dock layout geometry, panel visibility (persisted per-workspace) |
| `pluginStore` | registered plugins, enabled/disabled state |
| `appModeStore` | 'basic' \| 'advanced' |

**Data flow rule:** stores are updated only in response to events from the `RuntimeEventEmitter` or explicit user actions (never by components reaching into the adapter directly). This keeps the adapter → store boundary as the single place recording/replay logic has to be correct.

---

## 8. Runtime Adapter (design + interface)

```typescript
// features/runtime/adapter/types.ts

export type ScormApiMethod =
  | 'Initialize' | 'Terminate' | 'GetValue' | 'SetValue'
  | 'Commit' | 'GetLastError' | 'GetErrorString' | 'GetDiagnostic';

export interface ApiCallContext {
  sessionId: string;
  method: ScormApiMethod;
  element?: string;
  argument?: unknown;
  timestamp: number;
}

export interface ApiCallResult extends ApiCallContext {
  returnValue: unknown;
  durationMs: number;
  errorCode?: string;
}

/** A middleware can inspect/short-circuit before the call, and observe after. */
export interface RuntimeMiddleware {
  name: string;
  before?(ctx: ApiCallContext): Promise<'continue' | 'pause'> | 'continue' | 'pause';
  after?(result: ApiCallResult): void | Promise<void>;
}

export interface ScormRuntimeAdapter {
  readonly version: '1.2' | '2004';
  configure(profile: RuntimeProfile): void;
  attachPackage(pkg: Package): void;
  use(middleware: RuntimeMiddleware): void;
  start(sessionId: string): Promise<void>;
  stop(): Promise<void>;
  getSnapshot(): Record<string, unknown>;
  readonly events: RuntimeEventEmitter;
}
```

```typescript
// features/runtime/adapter/ScormRuntimeAdapter.ts (shape, not full impl)

export function createRuntimeAdapter(version: '1.2' | '2004'): ScormRuntimeAdapter {
  const scormAgain = version === '1.2' ? new Scorm12API(config) : new Scorm2004API(config);
  const middlewares: RuntimeMiddleware[] = [];
  const events = new RuntimeEventEmitter();

  async function dispatch(ctx: ApiCallContext, invoke: () => unknown): Promise<ApiCallResult> {
    for (const mw of middlewares) {
      if (mw.before && (await mw.before(ctx)) === 'pause') {
        events.emit('breakpoint:hit', ctx);
        await waitForResume();       // breakpointMiddleware owns this gate
      }
    }
    const startedAt = performance.now();
    const returnValue = invoke();     // the actual scorm-again call
    const result: ApiCallResult = {
      ...ctx, returnValue, durationMs: performance.now() - startedAt,
      errorCode: scormAgain.GetLastError(),
    };
    for (const mw of middlewares) await mw.after?.(result);
    events.emit('api-call', result);
    return result;
  }

  // Every scorm-again entry point is wrapped identically:
  scormAgain.on('SetValue', (element, value) =>
    dispatch({ sessionId, method: 'SetValue', element, argument: value, timestamp: Date.now() },
      () => scormAgain.SetValue(element, value)));
  // ...Initialize / Terminate / GetValue / Commit wired the same way

  return { version, configure, attachPackage, use: (m) => middlewares.push(m), start, stop, getSnapshot, events };
}
```

Built-in middleware (all implement `RuntimeMiddleware`):

- `recordingMiddleware` — `after` hook only; pushes every `ApiCallResult` into `logStore`.
- `breakpointMiddleware` — `before` hook; checks active `Breakpoint[]`, returns `'pause'` on match.
- `validationMiddleware` — `after` hook; runs runtime validators (missing Commit, out-of-range score, etc.) and pushes `ValidationIssue`s.
- `replayMiddleware` — `after` hook; appends to the `TimelineEvent` log used for scrubbing/replay.

Profiles (`RuntimeProfile`) don't add new middleware — they parameterize `scorm-again`'s own config (e.g., strict vs. lenient data-model validation, commit-on-every-set vs. batched) plus toggle which validators run. This keeps "SCORM Cloud" vs. "Moodle" behavior differences localized to configuration, not forked code paths.

---

## 9. Implementation Roadmap

Each milestone below must build and pass its own test suite before the next starts, per your instruction.

| # | Milestone | Deliverable | Exit criteria |
|---|---|---|---|
| 2 | Project scaffold | Vite + React 19 + TS strict + Tailwind v4 + shadcn/ui installed; ESLint import-boundary rules; empty feature folders with `index.ts` barrels | `npm run build` succeeds; lint passes; CI skeleton green |
| 3 | Package loader + Manifest parser | ZIP/folder/drag-drop ingestion, SCORM version detection, manifest tree parse (fast-xml-parser) | Load a real SCORM 1.2 and a real SCORM 2004 sample package; manifest tree renders correctly for both |
| 4 | Runtime adapter core | `ScormRuntimeAdapter`, `Scorm12Adapter`, `Scorm2004Adapter`, middleware pipeline, event bus — wired to real scorm-again, no UI yet | Headless test: load a package, drive it via the adapter, assert recorded `ApiCallRecord[]` matches expected sequence |
| 5 | Player + Basic Mode | Sandboxed iframe player, Basic Mode shell, progress/score/objectives display | A sample course can be launched, completed, and its final state shown correctly in Basic Mode |
| 6 | Advanced Mode shell + Dock layout | `DockLayout`, `PanelRegistry`, persistent layout, top toolbar | Panels can be dragged/resized/closed/reopened; layout survives reload |
| 7 | API Monitor, CMI Inspector, Console | Live-updating panels wired to `logStore`/`runtimeStore` | Every SCORM API call from a running package appears in the monitor within one frame; CMI tree reflects live state with diff highlighting |
| 8 | Timeline + Session Replay | `TimelinePanel`, scrubbing, snapshot restore | Can scrub to any point in a completed session and see the CMI state at that instant |
| 9 | Breakpoints | Breakpoint CRUD + pause/resume gate in adapter | Setting a breakpoint on a specific `SetValue` element reliably pauses execution before the value is applied |
| 10 | Validation engine | Static (manifest) + runtime validators, `ValidationPanel` | Known-bad sample packages (missing resource, broken suspend_data, out-of-range score) produce the expected issues |
| 11 | Runtime Profiles | Strict ADL / SCORM Cloud / Moodle / Canvas / SuccessFactors / Cornerstone / Custom | Switching profile visibly changes adapter behavior (e.g., strict data-model rejection on/off) against the same package |
| 12 | Reports | One-click QA report (JSON/CSV/Markdown/HTML export) | Generated report contains manifest summary, runtime summary, timeline, logs, and renders correctly as standalone HTML |
| 13 | Plugin system | `PluginHost`, `PluginApi`, panel/command/validator registration | A trivial sample plugin (e.g., a "hello world" inspector tab) can be registered and appears in the UI without touching core code |
| 14 | Storage/Network/Performance panels | Remaining Advanced-Mode panels | Each panel shows real data for a running session (IndexedDB contents, blob-URL "network" activity, timing metrics) |
| 15 | Hardening | Accessibility AA pass, Vitest coverage targets, Playwright e2e suite across sample packages | CI green across unit + e2e; axe-core audit passes on both modes |

I'd suggest we start Milestone 2 next — it's small, fast to verify, and gives us a real repo to build the rest against instead of continuing to design in the abstract. Let me know if you want any part of this milestone (domain model, adapter interface, roadmap ordering) revised before I do.
