# Roadmap

Same milestone list as `milestones/01-architecture-and-design.md` §9, kept here as the
version that gets checked off as work actually lands. Each milestone must
build (`pnpm run build`), lint clean (`pnpm run lint`), and typecheck
(`pnpm run typecheck`) before the next one starts.

- [x] **Milestone 2 — Project scaffold.** Vite + React 19 + TS strict +
      Tailwind v4 + pnpm; ESLint architecture-boundary rules
      (`no-restricted-imports` for scorm-again, `eslint-plugin-boundaries`
      for feature isolation) confirmed to actually fire, not just configured;
      shadcn/ui file
      conventions in place (`components.json`, `cn()`, hand-authored
      `Button` — CLI needs network access this sandbox didn't have);
      feature-first folder tree with README + barrel per feature; `/docs/`
      folder; `CLAUDE.md` + project skill for future Claude sessions.
- [x] **Milestone 3 — Package loader + Manifest parser.** ZIP/folder/drag-drop
      ingestion, SCORM version detection, manifest tree parse
      (fast-xml-parser). *Exit criteria:* load a real SCORM 1.2 and a real
      SCORM 2004 sample package; manifest tree renders correctly for both.
- [x] **Milestone 4 — Runtime adapter core.** `ScormRuntimeAdapter`,
      `Scorm12Adapter`, `Scorm2004Adapter`, middleware pipeline, event bus —
      wired to real scorm-again, no UI yet. *Exit criteria:* headless test
      drives a package via the adapter; recorded `ApiCallRecord[]` matches
      the expected call sequence.
- [x] **Milestone 5 — Player + Basic Mode.** Sandboxed iframe player, Basic
      Mode shell, progress/score/objectives display. *Exit criteria:* a
      sample course can be launched, completed, and its final state shown
      correctly in Basic Mode.
- [x] **Milestone 6 — Advanced Mode shell + Dock layout.** `DockLayout`,
      `PanelRegistry`, persistent layout, top toolbar. *Exit criteria:*
      panels can be dragged/resized/closed/reopened; layout survives reload.
- [x] **Milestone 7 — API Monitor, CMI Inspector, Console.** Live-updating
      panels wired to `logStore`/`runtimeStore`. *Exit criteria:* every
      SCORM API call appears in the monitor within one frame; CMI tree
      reflects live state with diff highlighting.
- [x] **Milestone 8 — Timeline + Session Replay.** `TimelinePanel`,
      scrubbing, snapshot restore. *Exit criteria:* scrub to any point in a
      completed session and see the CMI state at that instant.
- [x] **Milestone 9 — Breakpoints.** Breakpoint CRUD + pause/resume gate in
      the adapter. *Exit criteria:* a breakpoint on a specific `SetValue`
      element reliably pauses execution before the value is applied —
      matching `SetValue` parks before the value is applied; reads keep
      working while paused; resume drains parked calls in order.
- [x] **Milestone 10 — Validation engine.** Static (manifest) + runtime
      validators, `ValidationPanel`. *Exit criteria:* known-bad sample
      packages (missing resource, broken suspend_data, out-of-range score)
      produce the expected issues — missing launch file, missing resource
      file, broken item reference (manifest), out-of-range score, oversized
      suspend_data, missing Commit (runtime).
- [x] **Milestone 11 — Runtime Profiles.** Strict ADL / SCORM Cloud /
      Moodle / Canvas / SuccessFactors / Cornerstone / Custom. *Exit
      criteria:* switching profile visibly changes adapter behavior against
      the same package.
      *Removed in Milestone 17:* the LMS-named profiles only toggled three
      SCORM 1.2 status switches and were never verified against the real
      LMSs, so they implied an emulation that did not exist. The runtime now
      uses one fixed rule set modelled on SCORM Cloud.

## Recent infra updates

- [x] **Static SEO & build assets (dev+prod):** Added a small Vite plugin and
      shared SEO config to generate and serve `robots.txt`, `sitemap.xml`, and
      `llms.txt` at dev-time and build-time. See `src/shared/config/seo.ts` and
      `vite.config.ts`. *Next:* wire `siteUrl` from environment in CI, expand
      `routes` for dynamic pages, and surface SEO metadata in any server-side
      rendering if added later.
- [x] **Milestone 12 — Reports.** One-click QA report
      (JSON/CSV/Markdown/HTML export). *Exit criteria:* generated report
      contains manifest summary, runtime summary, timeline, logs, and
      renders correctly as standalone HTML.
- [x] **Milestone 13 — Plugin system.** `PluginHost`, `PluginApi`,
      panel/command/validator registration. *Exit criteria:* a trivial
      sample plugin registers and appears in the UI without touching core
      code.
- [x] **Milestone 14 — Storage/Network/Performance panels.** Remaining
      Advanced-Mode panels. *Exit criteria:* each panel shows real data for
      a running session. Verified in the browser against a live SCORM 1.2
      SCO: Package Explorer shows the extracted file tree with the launch
      file marked, Network shows real SW cache hits/misses with timing
      (3 requests, 3 hits), Storage shows Cache Storage buckets,
      `localStorage` keys, and the browser quota estimate (12 KB of 2.1 GB
      used), Performance shows per-call timings (18 calls, avg 0.8 ms,
      P95 5.4 ms) with top-5 slowest and per-method breakdown.
- [x] **Milestone 15 — Hardening.** *Exit criteria:* axe-core audit passes
      on both modes; Vitest coverage targets enforced; Playwright e2e suite
      runs against sample packages; CI is green across unit + e2e.
      Delivered in two passes.
      **Pass 1 — Accessibility AA.** vitest + axe-core test infrastructure
      (`vitest.config.ts`, `src/test/setup.ts`, `src/app/a11y.test.tsx` —
      5 tests covering empty and data-rich states of both modes) plus a
      live-browser axe audit (jsdom cannot compute real colors). Fixes:
      theme token contrast overrides for `slate-500/600` (4.9–6.2:1 on
      surface-950), `Button` default-hover and `destructive` text
      inversion, ARIA tabs pattern in `DockTabStrip` (roving tabindex,
      close button as tablist sibling), `tabIndex={0}` + focus ring on all
      13 scrollable panel bodies and the bottom-dock tabpanel
      (`scrollable-region-focusable`), and proper `role="treeitem"` +
      `aria-level` on every Package Explorer row. Verified: 5/5 vitest
      tests, 0 axe violations in both modes for both empty and data-rich
      states, 26 color-contrast nodes passing in the populated
      Advanced-mode audit.
      **Pass 2 — Coverage, e2e, CI.** Vitest v8 coverage with enforced
      thresholds (statements 35 / branches 20 / functions 30 / lines 35,
      headroom below the measured baseline so a regression fails CI) via
      `pnpm run test:coverage`; 7 new unit test files (68 tests: fileTree,
      PackageDetectionService, performanceMetrics, normalizeFlattenedCmi,
      validationService, ManifestParserService, fieldConfig) taking the
      suite to 73/73 green at 36.85% statements; Playwright e2e suite
      (`playwright.config.ts`, `e2e/` — 3 specs across 2 committed sample
      packages generated by `scripts/make-fixtures.mjs`) driving the real
      app: drop-zone load, manifest tree, SW-served player iframe, live
      CMI updates, and Basic ↔ Advanced mode switches without killing the
      running SCO; CI workflow (`.github/workflows/ci.yml`) with separate
      unit and e2e jobs (pnpm 11.20.0, Node 24, `--frozen-lockfile`,
      Playwright report uploaded on failure). All quality gates pass.
- [x] **Milestone 16 — Course player, session controls, SEO.** *Exit
      criteria:* a multi-SCO package can be navigated SCO by SCO; each SCO
      resumes from its stored attempt (`entry=resume`, suspend_data,
      location) or restarts clean; SCORM 2004 `adl.nav.request` continue /
      previous / choice / jump deliver the right SCO; manifest launch data
      (mastery score, launch data, time limits, completion threshold,
      passing score) reaches the runtime; packages can be opened, relaunched,
      reported on, and closed without a page reload. Verified by unit tests
      against real scorm-again (attempt export/restore, seeding, navigation
      events, error descriptions) and Playwright e2e on three new fixtures
      (multi-SCO 1.2, 2004 continue flow, folder-wrapped zip): 145 unit +
      7 e2e tests green, lint/typecheck/build clean.
      Also: xml:base and item `parameters` resolved; namespace-agnostic
      manifest parsing; SCORM 2004 2nd Edition (`CAM 1.3`) and SCORM 1.1
      detection; folder-wrapped zips re-rooted and reported as a package
      error; service worker ignores launch query strings; SEO metadata,
      JSON-LD, llms.txt, sitemap, and a landing screen from one config.

## Next candidates

- **SCORM 2004 sequencing engine.** Build scorm-again's `sequencing`
  activity tree from the manifest's `imsss:*` rules so pre/post-condition
  rules, rollup, and `adl.nav.request_valid` come from scorm-again instead
  of flow order.
- **Remove dead modules.** `features/plugins`, `StoragePanel`, and
  `ConsolePanel` are no longer wired into the app (see ARCHITECTURE.md).
