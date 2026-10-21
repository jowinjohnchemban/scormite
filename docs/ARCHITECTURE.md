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

## State

One Zustand store per feature — see `docs/DOMAIN_MODEL.md` for what each
store owns. Stores update only in response to `RuntimeEventEmitter` events
or explicit user actions; components never call the adapter directly.

## Course player (M16)

SCORMite plays the LMS for one course session. The course-session logic
lives in `src/app/course/` (the app layer, because it joins package-loader,
manifest, runtime, player, session, settings, and validation):

| Piece | Kind | Responsibility |
|---|---|---|
| `getLaunchableItems` (`features/manifest`) | pure function | Default-organization items that reference a resource with an href, in flow order, with launch paths built per the CAM `parameters` rules and `xml:base` applied |
| `CourseNavigator` | class | Previous / next in flow order; resolves SCORM 2004 navigation requests (`continue`, `previous`, `choice`, `jump`, `exitAll`, …) to the item to deliver |
| `AttemptStore` | class | The LMS's persistence for the session: last stored attempt per item |
| `ScoLauncher` | class | Builds one SCO's runtime: adapter + middleware (recording, breakpoints, validation) + manifest launch data + stored attempt + `window.API` proxy |
| `useCourseStore` (`app/state`) | Zustand | Items, current item, per-item progress, pending launch request |
| `usePackageSession` (`app/hooks`) | hook | Load / close packages, perform launches, follow navigation events, relaunch / new attempt / restart course |

**One runtime per launch.** Every SCO launch gets a fresh scorm-again
adapter, as scorm-again's own multi-SCO guidance prescribes. The LMS-side
data flow uses scorm-again end to end:

- *Before Initialize* — `seedLaunchData()` loads the item's manifest data
  (`datafromlms`, `masteryscore`, `maxtimeallowed`, `timelimitaction`,
  `completionThreshold`, primary-objective `minNormalizedMeasure`) plus
  `cmi.core.credit` through `loadFromFlattenedJSON`.
- *Leaving a SCO* — `exportAttempt()` stores scorm-again's terminate-commit
  payload (`renderCommitCMI(true)`, which accumulates `total_time`).
- *Resuming* — `restoreAttempt()` feeds that record to `loadFromJSON` with
  `entry` set to `resume` after a `suspend` exit (blank otherwise).
- *Navigation* — scorm-again parses `adl.nav.request` at Terminate and
  raises `SequenceNext` / `SequencePrevious` / `SequenceChoice` / …; the
  adapter forwards them as `navigation-request` runtime events and
  `CourseNavigator` picks the next item. Full IMS Simple Sequencing (an
  activity tree with rules, rollup, and `adl.nav.request_valid`) is not
  configured yet.
- *Errors* — every failed call records scorm-again's `GetErrorString` and
  `GetDiagnostic` on its `ApiCallRecord`.

**Launch ordering.** A launch is a two-step request: `requestLaunch` blanks
the player (unmounting the old iframe, whose unload handlers then call
`LMSFinish` / `Terminate` on the *old* runtime), and an effect performs the
launch after that commit. Injecting the new `window.API` first would route
the old SCO's unload-time calls into the new runtime.

**Session controls** (header, both modes): Open another package (or drop a
zip anywhere), Restart › Relaunch (resume) / New attempt / Restart whole
course, Report export, Close. A load error while a package is open is a
dismissible strip; the open session keeps running.

## Removed from the UI

`src/features/plugins/` (M13 plugin host), `StoragePanel`
(`features/storage`), and `ConsolePanel` (`features/logging`) are still in
the tree but no longer wired into the app: no plugin registration, plugin
menu, or plugin validators run, and neither panel is in `ADVANCED_PANELS`.

Runtime profiles (Strict ADL / SCORM Cloud / Moodle / Canvas /
SuccessFactors / Cornerstone) were removed entirely: they only toggled three
SCORM 1.2 status switches and were never verified against those LMSs. The
runtime uses one fixed rule set modelled on SCORM Cloud
(`LMS_BASE_SETTINGS` in `ScormRuntimeAdapter.ts`), and every runtime
validation rule always runs.

## Advanced-Mode inspection panels (M14)

Four panels complete the Advanced-Mode dock, all fed by real data:

- **Package Explorer** (`package-loader`): pure tree-building logic in
  `services/fileTree.ts`; `PackageExplorerPanel` renders it with a
  launch-file badge. The tree view is a subcomponent keyed by `pkg.id` so
  React remounts it per package instead of setting state in an effect.
- **Network** (`player`): the service worker (`public/sw.js`) broadcasts a
  `FETCH_EVENT` message (path, cache hit/miss, HTTP status, duration ms)
  for every package-file fetch to **all window clients** via
  `self.clients.matchAll({ type: 'window' })` — the SCO lives in a
  sandboxed iframe, so `event.clientId` alone would never reach the app
  UI. `networkMonitor.ts` listens on the window side and records into
  `useNetworkStore`; `NetworkPanel` renders the live log. The SW activates
  immediately (`skipWaiting` + `clients.claim`).
- **Storage** (`storage` feature): read-only browser-storage inspector —
  Cache Storage buckets, `localStorage` items, and global quota estimate
  via `StorageService` → `storageStore` → `StoragePanel`.
- **Performance** (`logging`): `performanceMetrics.ts` aggregates
  `ApiCallRecord`s (total, errors, avg, P95, max ms, top-5 slowest,
  per-method breakdown); `PerformancePanel` renders the cards.

Package Explorer, Network, and Performance are registered in
`src/app/layout/panels.ts` (`ADVANCED_PANELS`), alongside the Outline
panel added in M16; the Storage panel has since been removed from the dock
(see "Removed from the UI").

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
- **Color audit (browser only)** — axe's `color-contrast` rule cannot
  compute real colors in jsdom, so every theme-token change must be
  re-verified against the dev server with axe-core injected into the
  page. The populated Advanced-mode audit passes 26 contrast nodes.

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
| Brand images | `scripts/make-brand-assets.mjs` | Renders `public/og-image.png` and app icons with Playwright Chromium (outputs committed) |
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
