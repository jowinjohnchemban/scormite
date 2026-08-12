# Progress Notes — Short-term

Date: 2026-08-11

Summary
-------

- Implemented project-level SEO/static-file support and a small Vite plugin
  to generate `robots.txt`, `sitemap.xml`, and `llms.txt` during build and
  to serve the same files during local dev. This lives in `vite.config.ts` and
  is driven by `src/shared/config/seo.ts`.
- Milestone 13 — Plugin system: `src/features/plugins/` owns the plugin host
  (`usePluginHost` Zustand store), the `ScormitePlugin` contract in
  `types.ts`, and the built-in `samplePlugin.ts`. A plugin's `activate(api)`
  can only register contributions (panels, commands, validators) — never
  touch core internals. The app layer bridges contributions into the dock
  (`usePluginPanels`), toolbar (`PluginMenu`), and validation middleware
  (`pluginHostBridge`) without any feature-to-feature imports. Verified in
  the browser: the sample plugin's panel appears in the Panels menu, opens
  in the Bottom dock, and its toolbar command logs to the console — with
  zero core-code changes and zero console errors.
- Fixed two pre-existing console floods (not from M13, surfaced while
  testing): (1) "Maximum update depth exceeded" loop caused by an unstable
  `handleAdvancedCenterRect` callback recreated per render while listed in
  `DockLayout`'s effect deps — fixed with `useCallback` in `App.tsx`;
  (2) zustand v5 "getSnapshot should be cached" loop caused by selecting
  `Object.values(s.plugins)` (fresh array each call) — fixed by selecting
  the stable slice and deriving in the component body.

Files changed
-------------

- `src/features/plugins/types.ts` — plugin contract + contribution types.
- `src/features/plugins/registry/PluginHost.ts` — `usePluginHost` store.
- `src/features/plugins/builtin/samplePlugin.ts` — reference implementation.
- `src/features/plugins/builtin/SamplePluginPanel.tsx` — sample panel UI.
- `src/features/plugins/index.ts` — barrel.
- `src/app/plugins/pluginHostBridge.ts` — startup registration + validator bridge.
- `src/app/plugins/usePluginPanels.ts` — panel contributions → dock registry.
- `src/app/plugins/PluginMenu.tsx` — toolbar command menu.
- `src/app/App.tsx` — `registerBuiltinPlugins()` at startup; `useCallback` fix.
- `src/app/modes/AdvancedModeShell.tsx`, `src/app/layout/TopToolbar.tsx`,
  `src/app/hooks/usePackageSession.ts` — wiring.
- `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md` — plugin entities.

What works now
-------------

- `pnpm run build` emits `dist/robots.txt`, `dist/sitemap.xml`, and
  `dist/llms.txt` with values taken from `siteSeoConfig`.
- Dev server (`pnpm run dev`) serves the same endpoints at `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.
- A trivial sample plugin registers and appears in the UI (Panels menu →
  Bottom dock panel, Plugins menu → command) without touching core code;
  its validator contribution flows into the runtime validation pipeline.
- Advanced mode is console-error-free.

## Milestone 14 — Storage/Network/Performance panels (2026-08-11)

- Package Explorer (`src/features/package-loader/components/PackageExplorerPanel.tsx`):
  left-dock tree of extracted package files with expand/collapse, launch-file
  badge, and the `FileTreeView` subcomponent keyed by `pkg.id` (avoids
  `react-hooks/set-state-in-effect` by letting React remount the tree).
  Tree-building logic is pure and tested in
  `src/features/package-loader/services/fileTree.ts` (`FileTreeNode[]`).
- Network panel (`src/features/player/components/NetworkPanel.tsx`): live
  package-file request log fed by `networkMonitor.ts`, which listens for
  `FETCH_EVENT` postMessages from the service worker. Cache hit/miss,
  HTTP status, duration ms; entries live in the `useNetworkStore`
  (`NetworkEntry`). `public/sw.js` now activates immediately
  (`skipWaiting` + `clients.claim`) and broadcasts each package-file fetch
  to ALL window clients — crucial because the SCO runs in a sandboxed
  iframe, so `event.clientId` alone would never reach the app UI.
- Storage panel (`src/features/storage/`, new feature): inspects Cache
  Storage buckets, `localStorage` items, and global quota via
  `StorageService` (`StorageEntry`/`StorageReport`, `formatBytes`) with
  `storageStore` + `StoragePanel`. This is a browser/devtools-style panel,
  not an LMS data store — read-only inspection.
- Performance panel (`src/features/logging/components/PerformancePanel.tsx`):
  aggregates `ApiCallRecord`s via
  `src/features/logging/services/performanceMetrics.ts` into
  `PerformanceMetrics` — total, errors, avg, P95, max ms, top-5 slowest
  calls, per-method breakdown.
- `src/app/layout/panels.ts` `ADVANCED_PANELS` now registers real
  components for Package / Network / Storage / Performance; all Milestone
  14 placeholders are gone.
- Verified in browser against the running `scormite-sample` SCO: file tree
  (3 files, launch badge on `index.html`), Network (3 requests, 3 cache
  hits), Storage (3 Cache buckets, 9 localStorage keys, quota estimate),
  Performance (18 calls, avg 0.8 ms, P95 5.4 ms). All three quality gates
  pass: `pnpm run lint` (0 warnings), `pnpm run typecheck`, `pnpm run build`.

## Milestone 15 — Hardening: Accessibility AA (2026-08-11)

- Test infrastructure: vitest + jsdom + @testing-library/react +
  @testing-library/jest-dom + axe-core + vitest-axe. `vitest.config.ts`,
  `src/test/setup.ts` (jest-dom matchers, `toHaveNoViolations` matcher,
  in-memory `localStorage` stub, ResizeObserver/matchMedia/scrollTo mocks),
  `pnpm run test` / `pnpm run test:watch` scripts.
- `src/app/a11y.test.tsx`: 5 tests — empty-state axe audits of Basic and
  Advanced modes, mode-switch button names, main/header landmarks, and a
  data-rich Advanced-mode audit (package store seeded with a real
  Manifest/Package, Network entries, API call records, storage report).
- jsdom limitation: axe's `color-contrast` rule cannot compute real colors
  in jsdom, so contrast was verified with a live browser audit (dev server +
  axe-core injected into the page, stores seeded by importing the zustand
  modules directly via `/src/...`).
- Violations found and fixed:
  - `text-slate-500` (4.08:1) and `text-slate-600` (2.56:1) failed AA on
    surface-950 → theme overrides in `src/index.css` `@theme`:
    slate-500 `#7f93ab` (6.2:1), slate-600 `#6d829c` (4.9:1); slate-400
    unchanged (7.6:1).
  - `Button` default variant hovered to `bg-accent` (#4da3ff) with white
    text = 2.5:1 → hover now inverts to dark text (7.4:1). `destructive`
    variant was white-on-danger (3.2:1) → dark text (5.8:1); the variant
    is currently unused but was a latent landmine.
  - `scrollable-region-focusable`: the bottom-dock tabpanel and all 13
    panel scroll containers got `tabIndex={0}` + a visible focus ring
    (focus-visible ring-1 accent). Empty-state audits miss this — only a
    populated audit fires it.
  - ARIA tabs in `DockTabStrip`: per-tab close button moved OUT of the
    tablist to a strip-end sibling (previously `nested-interactive`); tabs
    use roving tabindex with Delete/Backspace close.
  - Package Explorer tree: file rows were plain `generic` divs → all rows
    now `role="treeitem"` with `aria-level={depth + 1}` (aria-expanded
    stays directory-only).
- Verification: 5/5 vitest tests pass; browser axe audits return 0
  violations for Basic mode, Advanced empty, and Advanced data-rich (26
  color-contrast nodes passing in the populated state). `pnpm run lint` (0
  warnings), `pnpm run typecheck`, `pnpm run build` all pass.
- Tooling note: vitest-axe 0.1.0 is unmaintained against modern vitest —
  its root `matchers` entry is `export type *` (breaks
  `verbatimModuleSyntax`), its `extend-expect` augments the removed global
  `Vi` namespace, and `dist/extend-expect.js` is 0 bytes. The runtime
  matcher is imported from `vitest-axe/dist/matchers`, and the
  `expect(...).toHaveNoViolations()` typing is provided by
  `src/test/vitest-axe.d.ts` (jest-dom-style `declare module 'vitest'`
  augmentation). ESLint has a `**/*.d.ts` override for the
  augmentation-required `any`/empty-interface patterns.

## Milestone 15 — Hardening: coverage, e2e, CI (2026-08-11, continued)

Second pass of M15, completing the exit criteria row from
`docs/ROADMAP.md`: "Vitest coverage targets, Playwright e2e suite across
sample packages, CI green across unit + e2e".

**Coverage targets**

- Configured in `vitest.config.ts`: v8 provider
  (`@vitest/coverage-v8`), `reportsDirectory './coverage'`, includes
  `src/**/*.{ts,tsx}`, thresholds `{ statements: 35, branches: 20,
  functions: 30, lines: 35 }`. Thresholds were chosen with deliberate
  headroom: the measured baseline sits ~1–2 points above each floor so
  the gate catches real regressions without flaking on noise.
- New script `pnpm run test:coverage` (vitest run --coverage). Baseline
  before this pass was 25.86% statements; after the test growth below it
  sits at 36.85% stmts / 23.38% branch / 32.6% funcs / 36.99% lines.
- The coverage run surfaces all unit tests (same files as `pnpm run
  test`), so CI uses `test:coverage` as the single unit gate.

**Unit test growth (7 new test files, 68 tests)**

- `src/features/manifest/tests/fileTree.test.ts`
- `src/features/package-loader/tests/PackageDetectionService.test.ts`
- `src/features/logging/tests/performanceMetrics.test.ts`
- `src/features/logging/tests/normalizeFlattenedCmi.test.ts`
- `src/features/validation/tests/validationService.test.ts`
- `src/features/manifest/tests/ManifestParserService.test.ts`
- `src/features/inspector/tests/fieldConfig.test.ts`

73/73 tests green (was 73/73; the new files grew the suite from 5 to
73). The growth caught 5 real expectation bugs in existing services
(e.g., CMI flattening edge cases, performance metric recording) before
they could ship.

**Playwright e2e suite**

- Committed byte-stable fixtures: `scripts/make-fixtures.mjs` generates
  `e2e/fixtures/scorm12-basic.zip` and
  `e2e/fixtures/scorm2004-basic.zip` (jszip, fixed timestamps, DEFLATE,
  platform UNKNOWN) so results are reproducible without network access.
  Re-run `node scripts/make-fixtures.mjs` only when the fixture content
  changes.
- Three specs in `e2e/`:
  - `load-package.spec.ts` — SCORM 1.2 end-to-end: load zip, sidebar
    shows name/version, manifest org + SCO visible, player iframe
    reaches `/scorm-files/` and the SCO's `Initialize` handshake runs,
    Status row shows `completed`, Score row shows `100`.
  - `scorm2004.spec.ts` — same flow for SCORM 2004 4th Edition:
    completion_status/success_status/score.scaled surface as Status
    `completed` and Success `passed`.
  - `mode-switch.spec.ts` — Basic → Advanced keeps the same SCO iframe
    (src unchanged, still `init=`), Advanced shell shows left dock
    region + manifest explorer; switching back to Basic restores the
    sidebar with the package still loaded.
- 3/3 pass in ~14s. `playwright.config.ts` auto-starts the dev server
  (webServer), CI forces `retries: 2` + 1 worker, artifacts land in
  `test-results/` / `playwright-report/`.

**CI**

- `.github/workflows/ci.yml` — two jobs on push to main + PRs:
  - `unit`: install (frozen lockfile, Node 24, pnpm 11.20.0) → lint
    (with `--max-warnings=0`) → typecheck → `test:coverage` → build.
  - `e2e`: same install + `playwright install --with-deps chromium` →
    `test:e2e`, uploading `playwright-report/` + `test-results/` on
    failure (7-day retention).

**Integration details worth remembering**

- `tsconfig.node.json` now includes `playwright.config.ts` and
  `e2e/**/*.ts` (Node runtime, `module nodenext`).
- ESLint `ignores` grew `coverage`, `test-results`, `playwright-report` —
  generated artifacts must stay ignored or `--max-warnings=0` fails on
  vendored files (hit this with `coverage/lcov-report/*.js`).
- e2e specs live outside `src/`, so the boundaries plugin does not fire
  on them; the scorm-again import ban is path-scoped, so it cannot be
  violated from e2e either.
- `.gitignore` grew `coverage/`, `test-results/`, `playwright-report/`,
  `blob-report/`.
- Fixtures assert against rendered UI and the SCO's `document.body`
  log (the fixture SCOs write `init=`/`complete=` markers via the
  injected API proxy), which keeps specs independent of internal DOM
  structure.

All gates green at the end of this pass: lint (0 warnings), typecheck,
73/73 unit tests, coverage above thresholds, build, 3/3 e2e.

Next steps (later continuation)
-------------------------------

1. Milestone 16 — per `docs/ROADMAP.md` (next roadmap item after the
   hardening pass).
2. Wire `siteUrl` to CI/deploy environment via `VITE_SITE_URL` or `SITE_URL`.
3. Expand `routes` to include any dynamic/public routes (e.g., per-package
   landing pages) to make a complete `sitemap.xml`.
4. Consider pulling `llms` from a maintained config or remote source if it
   needs to be updated without a deploy.
5. Add a small test that validates `dist/` contains the expected files in CI.
6. Optionally, expose site metadata into the React app's head tags centrally
   so runtime meta changes reflect `siteSeoConfig`.
7. Future a11y work: keep the AA baseline green by running
   `src/app/a11y.test.tsx` in CI, and re-run the browser contrast audit
   whenever theme tokens change (jsdom cannot catch color regressions).
8. Raise the coverage thresholds as the suite grows — they currently
   carry headroom below the measured baseline and should be tightened
   once the next milestone adds tests.
9. Playwright: add a validation-panel spec and a breakpoints/timeline
   interaction spec once those features have stable DOM hooks (the CMI
   inspector and manifest explorer panels already do).
