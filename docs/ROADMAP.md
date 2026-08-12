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
- [x] **Milestone 15 — Hardening.** Accessibility AA pass. *Exit criteria:*
      axe-core audit passes on both modes. Delivered: vitest + axe-core test
      infrastructure (`vitest.config.ts`, `src/test/setup.ts`,
      `src/app/a11y.test.tsx` — 5 tests covering empty and data-rich states
      of both modes) plus a live-browser axe audit (jsdom cannot compute
      real colors). Fixes: theme token contrast overrides for
      `slate-500/600` (4.9–6.2:1 on surface-950), `Button` default-hover
      and `destructive` text inversion, ARIA tabs pattern in
      `DockTabStrip` (roving tabindex, close button as tablist sibling),
      `tabIndex={0}` + focus ring on all 13 scrollable panel bodies and the
      bottom-dock tabpanel (`scrollable-region-focusable`), and proper
      `role="treeitem"` + `aria-level` on every Package Explorer row.
      Verified: 5/5 vitest tests, 0 axe violations in both modes for both
      empty and data-rich states, 26 color-contrast nodes passing in the
      populated Advanced-mode audit. All quality gates pass.
