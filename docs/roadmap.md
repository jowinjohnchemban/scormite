# Roadmap

What has been delivered, milestone by milestone, with each milestone's exit
criteria — and what comes next. The milestone plan started in the
[original design](archive/original-design.md#9-implementation-roadmap);
this is the record of what actually landed, including what was later
removed and why. A milestone is finished only when it meets the
[definition of done](development.md#definition-of-done).

## Delivered

- [x] **Milestone 1 — Architecture and design.** Layering, folder
      structure, domain model, runtime adapter interface, and the milestone
      plan, written before any code
      ([archived](archive/original-design.md)).
- [x] **Milestone 2 — Project scaffold.** Vite + React 19 + TS strict +
      Tailwind v4 + pnpm; ESLint architecture-boundary rules
      (`no-restricted-imports` for scorm-again, `eslint-plugin-boundaries`
      for feature isolation) confirmed to actually fire, not just configured;
      shadcn/ui file
      conventions in place (`components.json`, `cn()`, hand-authored
      `Button` — CLI needs network access this sandbox didn't have);
      feature-first folder tree with README + barrel per feature; `docs/`
      folder; agent instructions.
- [x] **Milestone 3 — Package loader + Manifest parser.** ZIP/folder/drag-drop
      ingestion, SCORM version detection, manifest tree parse
      (fast-xml-parser). _Exit criteria:_ load a real SCORM 1.2 and a real
      SCORM 2004 sample package; manifest tree renders correctly for both.
- [x] **Milestone 4 — Runtime adapter core.** `ScormRuntimeAdapter`,
      `Scorm12Adapter`, `Scorm2004Adapter`, middleware pipeline, event bus —
      wired to real scorm-again, no UI yet. _Exit criteria:_ headless test
      drives a package via the adapter; recorded `ApiCallRecord[]` matches
      the expected call sequence.
- [x] **Milestone 5 — Player + Basic Mode.** Sandboxed iframe player, Basic
      Mode shell, progress/score/objectives display. _Exit criteria:_ a
      sample course can be launched, completed, and its final state shown
      correctly in Basic Mode.
- [x] **Milestone 6 — Advanced Mode shell + Dock layout.** `DockLayout`,
      `PanelRegistry`, persistent layout, top toolbar. _Exit criteria:_
      panels can be dragged/resized/closed/reopened; layout survives reload.
      _Milestone 17:_ moving panels between docks (drag-and-drop, per-panel
      dock buttons) and the activity bars were removed — layout furniture
      that did not help test a package. Panels have fixed homes and can be
      shown, hidden, and resized.
- [x] **Milestone 7 — API Monitor, CMI Inspector, Console.** Live-updating
      panels wired to `logStore`/`runtimeStore`. _Exit criteria:_ every
      SCORM API call appears in the monitor within one frame; CMI tree
      reflects live state with diff highlighting.
      _The Console panel was removed in Milestone 17_ (not reachable from
      the UI).
- [x] **Milestone 8 — Timeline + Session Replay.** `TimelinePanel`,
      scrubbing, snapshot restore. _Exit criteria:_ scrub to any point in a
      completed session and see the CMI state at that instant.
- [x] **Milestone 9 — Breakpoints.** Breakpoint CRUD + pause/resume gate in
      the adapter. _Exit criteria:_ a breakpoint on a specific `SetValue`
      element reliably pauses execution before the value is applied —
      matching `SetValue` parks before the value is applied; reads keep
      working while paused; resume drains parked calls in order.
- [x] **Milestone 10 — Validation engine.** Static (manifest) + runtime
      validators, `ValidationPanel`. _Exit criteria:_ known-bad sample
      packages (missing resource, broken suspend_data, out-of-range score)
      produce the expected issues — missing launch file, missing resource
      file, broken item reference (manifest), out-of-range score, oversized
      suspend_data, missing Commit (runtime).
- [x] **Milestone 11 — Runtime Profiles.** Strict ADL / SCORM Cloud /
      Moodle / Canvas / SuccessFactors / Cornerstone / Custom. _Exit
      criteria:_ switching profile visibly changes adapter behavior against
      the same package.
      _Removed in Milestone 17:_ the LMS-named profiles only toggled three
      SCORM 1.2 status switches and were never verified against the real
      LMSs, so they implied an emulation that did not exist. The runtime now
      uses one fixed rule set modelled on SCORM Cloud.
- [x] **Milestone 12 — Reports.** One-click QA report
      (JSON/CSV/Markdown/HTML export). _Exit criteria:_ generated report
      contains manifest summary, runtime summary, timeline, logs, and
      renders correctly as standalone HTML.
      _Milestone 17:_ export moved to the header (the Reports panel only
      duplicated it); reports gained per-item course results and error
      explanations, CSV became a single API-log table, Markdown cells are
      escaped, and the HTML report prints cleanly.
- [x] **Milestone 13 — Plugin system.** `PluginHost`, `PluginApi`,
      panel/command/validator registration. _Exit criteria:_ a trivial
      sample plugin registers and appears in the UI without touching core
      code. _Removed in Milestone 17_ — no longer reachable from the UI.
- [x] **Milestone 14 — Storage/Network/Performance panels.** Remaining
      Advanced-Mode panels. _Exit criteria:_ each panel shows real data for
      a running session. Verified in the browser against a live SCORM 1.2
      SCO: Package Explorer shows the extracted file tree with the launch
      file marked, Network shows real SW cache hits/misses with timing
      (3 requests, 3 hits), Storage shows Cache Storage buckets,
      `localStorage` keys, and the browser quota estimate (12 KB of 2.1 GB
      used), Performance shows per-call timings (18 calls, avg 0.8 ms,
      P95 5.4 ms) with top-5 slowest and per-method breakdown.
      _Storage and Performance were removed in Milestone 17_ — Storage was
      unreachable; Performance's in-memory call timings did not reflect LMS
      performance (per-method counts moved to the API Monitor).
- [x] **Milestone 15 — Hardening.** _Exit criteria:_ axe-core audit passes
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
- [x] **Milestone 16 — Course player, session controls, SEO.** _Exit
      criteria:_ a multi-SCO package can be navigated SCO by SCO; each SCO
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
- [x] **Milestone 17 — Sequencing, honesty pass, production polish.**
      _Exit criteria:_ SCORM 2004 courses are driven by scorm-again's
      sequencing engine from the manifest's `imsss` rules; every feature
      shown is real and does what it says; the app works from 320 px up;
      the start page does not download the runtime. Delivered:
      `SequencingParser` + activity tree, `SequencingConfigBuilder` (with
      warnings for anything not evaluable), engine-driven `CourseSession`
      (e2e: a precondition gate on a global objective); removed runtime
      profiles, the plugin system, and the Storage / Console / Performance /
      Reports panels; breakpoints limited to calls that can be held honestly;
      validation rules corrected (SCORM 1.2-only score range,
      edition-specific suspend_data limits, commit tracking, percent-encoded
      file hrefs); Manifest / Package / Network / CMI Inspector / API Monitor
      made genuinely useful; reports with course results; tabbed mobile
      sidebar and responsive header; error boundary; initial JavaScript cut
      from 913 kB to 279 kB; a new pixel-exact brand mark; docs hub. 175
      unit + 8 e2e tests green; lint, typecheck, build clean.

## Since Milestone 17

- [x] **Saved progress.** Attempts, position, and sequencing state kept in
      IndexedDB; reopening a package resumes it.
- [x] **Learner identity.** Set from the header, seeded into each launch;
      a sample learner until one is set.
- [x] **Runtime and readability fixes.** Each SCO loads once per launch;
      `total_time` and empty collections appear in the CMI; a `runtime.status-overridden`
      warning explains a status the LMS rules changed on exit; Basic mode's
      API log and package summary made readable; panels renamed for what
      they show (Files, API Log, CMI History).

## Next

No milestone is scheduled. Known gaps are listed under
[Known limitations](scorm-support.md#known-limitations) and in the
unsupported standards of [SCORM support](scorm-support.md#standards).
