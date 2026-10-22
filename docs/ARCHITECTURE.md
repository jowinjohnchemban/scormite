# Architecture

This is the living reference. The original full design rationale is in
`milestones/01-architecture-and-design.md` — this file is the version that's meant to be kept in
sync with the actual code as the codebase grows. When the two disagree,
the code and this file win; the milestone doc is a historical snapshot.

## Layers

```
UI (React)
  → Studio Services (pure application logic, no React/DOM)
    → Runtime Adapter (wraps scorm-again; the only layer allowed to import it)
      → scorm-again (vendored, never modified)
        → SCORM Package (iframe-sandboxed)
```

**Enforced, not just documented:** `eslint.config.js` uses `no-restricted-imports`
to block `scorm-again` imports outside `src/features/runtime/`, and
`eslint-plugin-boundaries` to block one feature from importing another
feature's internals (only `app`, `shared`, `components`, and same-feature
imports are allowed). Run `pnpm run lint` — both rules are exercised by the
project's own code, so a regression here fails CI, not just code review.

## Folder structure

See each `src/features/<name>/README.md` for what that feature owns. The
top-level shape:

```
src/
  app/            # shell, mode switch, dock layout engine
  features/       # one folder per feature (see individual READMEs)
  components/     # shared dumb UI (shadcn-pattern primitives, icons)
  shared/         # cross-feature utilities, types, test helpers
```

## Modes

`useAppModeStore` (`src/app/state/appModeStore.ts`) is the single source of
truth for Basic vs. Advanced mode. Components read this store; nothing
branches on route or URL for mode switching.

The two mode shells are chrome only. `App` owns the single
`usePackageSession` subscription and renders a persistent player layer (the
SCO iframe) that is never unmounted, positioned behind whichever shell is
active — so switching Basic ↔ Advanced swaps the surrounding chrome without
detaching the iframe, which would destroy its browsing context and restart
the running course. The shells receive the session as a prop and never
render a second iframe.

## Loading and failure

- **On demand.** The start page loads only the shell. Opening a package
  goes through `src/app/course/openPackage.ts`, loaded with `import()`;
  scorm-again, jszip, and the XML parser live in their own
  `package-runtime` chunk (see `build.rolldownOptions` in
  `vite.config.ts`), and Advanced mode's dock is `React.lazy`. Project
  modules are declared side-effect free (`"sideEffects": ["**/*.css"]` in
  `package.json`) so feature barrels do not pull the runtime into the
  start page — keep new modules free of import-time side effects, or list
  them there.
- **Errors.** `ErrorBoundary` (a class component) wraps the mode shells: a
  rendering failure shows a retry instead of a blank page, the header
  stays usable, and opening another package clears it. Package load
  failures surface as `OpenPackageError` messages.

## State

One Zustand store per feature — see `docs/DOMAIN_MODEL.md` for what each
store owns. Stores update only in response to `RuntimeEventEmitter` events
or explicit user actions; components never call the adapter directly.

## Course player (M16–M17)

SCORMite plays the LMS for one course session. The course-session logic
lives in `src/app/course/` (the app layer, because it joins package-loader,
manifest, runtime, player, session, and validation):

| Piece | Kind | Responsibility |
|---|---|---|
| `getLaunchableItems` / `getActivityTree` (`features/manifest`) | pure functions | Launchable items in flow order (launch paths per the CAM `parameters` rules, `xml:base` applied); the SCORM 2004 activity tree with each activity's parsed `imsss` sequencing (`SequencingParser`) |
| `CourseSession` | class | One open package: starts the course, delivers SCOs, hands learner navigation to the engine, stores / restores attempts, publishes progress and navigation availability |
| `ScoLauncher` | class | Builds runtimes (a fresh one per SCO, or one sequenced runtime per course) with the middleware pipeline, and delivers an item into a runtime: manifest launch data + stored attempt + `window.API` proxy |
| `CourseNavigator` | class | Flow-mode previous / next and resolution of SCO navigation requests |
| `AttemptStore` | class | The LMS's persistence for the session: last stored attempt per item |
| `SessionPersistence` | class | Saved progress across reloads (IndexedDB behind a `KeyValueStore`): attempts, progress, current item, serialized sequencing state; keyed by manifest hash + zip size; saved on Commit (coalesced), Terminate and every delivery |
| `useCourseStore` (`app/state`) | Zustand | Items, current item, progress, navigation availability, pending launch / navigation; `go()` is the one entry point for navigation |
| `usePackageSession` (`app/hooks`) | hook | React glue: load / close packages, run pending launches and navigation through the `CourseSession` |

**Two ways to play a course.**

- *SCORM 2004 — sequenced.* The activity tree goes to scorm-again's SCORM
  2004 sequencing engine (`SequencingConfigBuilder` maps it; anything the
  engine cannot evaluate faithfully is reported as a `sequencing.unsupported`
  warning instead of approximated). One runtime serves the whole course:
  the engine's `start`, SCO-initiated `adl.nav.request`s, and the learner's
  outline / Previous / Next requests all go through it, and it announces
  each SCO to deliver; between SCOs the runtime is `reset()` (sequencing
  state survives). Outline items the rules do not allow are disabled using
  the engine's look-ahead (`predictChoiceEnabled` / continue / previous),
  Previous / Next honour `hideLMSUI`, and statuses come from the engine's
  rollup. If the engine cannot start the course it falls back to flow mode
  with a `sequencing.start-failed` warning.
- *SCORM 1.2 (and the fallback) — flow.* A fresh runtime per SCO, as
  scorm-again's multi-SCO guidance prescribes; navigation in manifest
  order, and a 2004 SCO's `adl.nav.request` is resolved by
  `CourseNavigator`.

**LMS-side data flow** — scorm-again end to end:

- *Before Initialize* — `seedLaunchData()` loads the item's manifest data
  (`datafromlms`, `masteryscore`, `maxtimeallowed`, `timelimitaction`,
  `completionThreshold`, primary-objective `minNormalizedMeasure`) plus
  `cmi.core.credit` through `loadFromFlattenedJSON`.
- *Leaving a SCO* — `exportAttempt()` stores scorm-again's terminate-commit
  payload (`renderCommitCMI(true)`, which accumulates `total_time`).
- *Resuming* — `restoreAttempt()` feeds that record to `loadFromJSON` with
  `entry` set to `resume` after a `suspend` exit (blank otherwise).
- *Errors* — every failed call records scorm-again's `GetErrorString` and
  `GetDiagnostic` on its `ApiCallRecord`; refused navigation requests
  become `sequencing.request-refused` warnings.

**Runtime version.** scorm-again 3.4.6. Upstream fixes are adopted by
upgrading, never by patching: 3.4.6 fixed a retried activity keeping its
previous primary-objective status (pinned by a test), and reports a
course's refused navigation through `onSequencingError` (with the IMS
exception code), which the adapter turns into a readable
`sequencing.request-refused` warning.

**Launch ordering.** Launches and engine navigation are two-step
requests: the request blanks the player (unmounting the old iframe, whose
unload handlers then call `LMSFinish` / `Terminate` on the *old* runtime
state), and an effect performs the launch or navigation after that commit.
Injecting the next SCO's state first would route the old SCO's unload-time
calls into it.

**Session controls** (header, both modes): Open another package (or drop a
zip anywhere), Restart › Relaunch (resume) / New attempt / Restart whole
course, Report export, Close. A load error while a package is open is a
dismissible strip; the open session keeps running.

## Removed features

Features that did not earn their place were removed from the product and
the code, not just hidden:

- The **plugin system** (M13), the **Storage** panel (M14), and the
  **Console** panel (M7) — none was reachable from the UI any more.

- **Moving panels between docks** (drag-and-drop, per-panel L / R / B dock
  buttons) and the **activity bars** — layout furniture that added
  controls and odd layout states without helping anyone test a package.

- **Runtime profiles** (Strict ADL / SCORM Cloud / Moodle / Canvas /
  SuccessFactors / Cornerstone) only toggled three SCORM 1.2 status
  switches and were never verified against those LMSs. The runtime uses one
  fixed rule set modelled on SCORM Cloud (`LMS_BASE_SETTINGS` in
  `ScormRuntimeAdapter.ts`), and every runtime validation rule always runs.

## Advanced-mode panels

Each panel has a fixed home dock, set in its definition (`region`), and a
purpose group (`group`: course / runtime / problems) the Panels menu uses.
`PanelRegistry` persists only show/hide choices and the active bottom tab;
dock sizes are persisted by react-resizable-panels. Moving panels between
docks was removed (see "Removed features").


Every panel in `src/app/layout/panels.ts` (`ADVANCED_PANELS`) shows real
data from the running session and earns its place by answering a question a
tester actually has:

| Panel | Owner | Answers |
|---|---|---|
| Outline | `app/course` | Where am I in the course, what may I open next, how did each item end? |
| Manifest | `manifest` | What exactly did the manifest declare for this item (resource, href, parameters, launch data, sequencing)? |
| Package | `package-loader` | Which files are in the zip, and which are launch files? |
| CMI Inspector | `inspector` | What is in the data model now, and what just changed? (filter by path or value) |
| Validation | `validation` | What is wrong with the package or the run? |
| API Monitor | `logging` | What did the course call, with what, and why did a call fail? (per-method counts, failed-only filter) |
| Network | `player` | Which files did the course request, and which are missing from the package? |
| Timeline | `timeline` | What did the data model look like at any earlier point of this attempt? |
| Breakpoints | `session` | What is the state just before a specific SetValue / Commit is applied? |

**Network.** The service worker (`public/sw.js`) posts a `FETCH_EVENT`
for every package-file fetch to **all window clients** — the SCO lives in a
sandboxed iframe, so `event.clientId` alone would never reach the app UI.
`networkMonitor.ts` records them into `useNetworkStore`.

**Breakpoints.** The SCORM API is synchronous: a SCO cannot be made to wait.
A breakpoint therefore *holds* a matching `SetValue` or `Commit` — and every
mutation after it, Terminate included — answering `"true"` at once and
applying the held calls in order on Resume. Initialize, Terminate, and reads
are never breakpoint targets, because holding them would mean lying to the
course about whether it started or what a value is.

**Removed for not earning their place:** Performance (in-memory API call
timings say nothing about LMS performance; per-method counts moved to the
API Monitor) and Reports (duplicated the header's Report export).

## Accessibility (M15)

WCAG 2.1 AA is an enforced baseline, verified by axe-core in two layers:

- **Structural audit (CI)** — `src/app/a11y.test.tsx` renders both modes
  (empty and data-rich states) under vitest + jsdom and asserts zero axe
  violations. Test infrastructure: `vitest.config.ts` +
  `src/test/setup.ts` (jest-dom matchers, the `toHaveNoViolations`
  matcher, an in-memory `localStorage` stub — Node's experimental global
  throws without `--localstorage-file` — and ResizeObserver/matchMedia/
  scrollTo mocks). Data-rich state is seeded by calling
  `useXStore.setState(...)` directly with real Manifest/Package/Network/
  log/storage shapes.
- **Browser audit (e2e)** — axe's `color-contrast` rule cannot compute
  real colours in jsdom, so `e2e/accessibility.spec.ts` runs axe-core in
  Chromium on the start page, Basic mode, the Learner popover, Advanced
  mode with every panel open, and the phone layout's tabs, and fails on any
  WCAG 2.1 AA violation, contrast included.

Conventions enforced by this milestone:

- **Contrast tokens** — `src/index.css` `@theme` overrides Tailwind's
  default slate-500 (`#7f93ab`, 6.2:1) and slate-600 (`#6d829c`, 4.9:1)
  on surface-950; the Tailwind defaults (4.08:1 / 2.56:1) fail AA. Keep
  the 400 > 500 > 600 luminance hierarchy. Bright accent fills
  (`bg-accent` #4da3ff) must not carry white text — `Button`'s default
  variant inverts to dark text on hover, and `destructive` uses dark text.
- **Scrollable regions are focusable** — every scroll container that
  users can tab into (every panel body plus the bottom-dock tabpanel)
  carries `tabIndex={0}` and a `focus-visible` ring; otherwise axe fires
  `scrollable-region-focusable` (which only appears when the container is
  *actually* scrollable — empty-state audits miss it).
- **ARIA tabs** — `DockTabStrip` implements the tabs pattern: `role="tab"`
  buttons with roving tabindex, `role="tabpanel"` + `aria-labelledby`, and
  per-tab close controls as **siblings** of the tablist (a close button
  nested inside the tab is `nested-interactive`).
- **Tree semantics** — Package Explorer rows are `role="treeitem"` with
  `aria-level={depth + 1}` on every row; `aria-expanded` only on
  directories.

Tooling caveat: vitest-axe 0.1.0 is unmaintained against modern vitest —
import the matcher from `vitest-axe/dist/matchers` (the root entry is
`export type *`, breaking `verbatimModuleSyntax`) and augment the
`expect(...)` typing via `src/test/vitest-axe.d.ts` (jest-dom-style
`declare module 'vitest'`); vitest-axe's own `extend-expect` targets the
removed global `Vi` namespace and its runtime file is empty. ESLint allows
the augmentation-required `any`/empty-interface patterns for `**/*.d.ts`.

## Styling

Tailwind v4 via `@tailwindcss/vite` (no separate `tailwind.config.*` — theme
tokens live in `@theme` inside `src/index.css`). UI primitives follow the
shadcn/ui file convention (`src/components/ui/*.tsx`, `cn()` helper in
`src/shared/lib/utils.ts`, `components.json` at the root) so `pnpm dlx shadcn
add <component>` works normally once you're on a machine with network access
to `ui.shadcn.com` — the sandbox this scaffold was built in has that domain
blocked, so `Button` was hand-authored to match the CLI's output shape
exactly; treat it as a stand-in for the real CLI run.

## Tooling

| Concern | Tool | Config |
|---|---|---|
| Package manager | pnpm | `.npmrc`, `packageManager` field in `package.json` |
| Build | Vite | `vite.config.ts` |
| Types | TypeScript (strict) | `tsconfig.app.json` |
| Lint + architecture boundaries | ESLint flat config | `eslint.config.js` |
| Format | Prettier | defaults, via `pnpm run format` |
| Unit tests + coverage | Vitest + @vitest/coverage-v8 | `vitest.config.ts` (`src/**` and `build/**` tests; thresholds 35/20/30/35, `pnpm run test:coverage`) |
| SEO / metadata | Vite plugin `build/seoPlugin.ts` | Renders head tags, JSON-LD, no-JS fallback, robots.txt, sitemap.xml, llms.txt, manifest.webmanifest from `src/shared/config/seo.ts`; set `VITE_SITE_URL` per deployment |
| Brand | `scripts/brand/mark.mjs`, `scripts/make-brand-assets.mjs` | The logo is generated from parameters on a 2:1 pixel-isometric integer grid (pixel-exact at native sizes): `logo-mark.svg` (dark surfaces), `logo-mark-24.svg` (24 px header), `logo.svg` (tile: favicon, README), PNG icons, and the social image — all committed |
| E2E | Playwright | `playwright.config.ts` (`e2e/`, auto-starts dev server, committed fixtures in `e2e/fixtures/`) |
| CI | GitHub Actions | `.github/workflows/ci.yml` (unit + e2e jobs) |

## Adding a new feature

1. `mkdir src/features/<name>` with `README.md` + `index.ts` (barrel) at minimum.
2. Add it to the roadmap in `docs/ROADMAP.md` if it's not already there.
3. If it needs to depend on another feature, that dependency must go through
   the target feature's `index.ts` — `eslint-plugin-boundaries` will fail the
   build otherwise.
4. If it needs scorm-again, it doesn't — go through `@/features/runtime`
   instead. `no-restricted-imports` will fail the build otherwise.

## Architecture Decision Records

Non-obvious or debatable technical choices get an ADR in `docs/adr/`, not
just a comment. See `docs/adr/0001-use-eslint-boundaries-for-architecture.md`
for the template/example.
