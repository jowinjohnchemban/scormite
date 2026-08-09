# Roadmap

Same milestone list as `milestones/01-architecture-and-design.md` §9, kept here as the
version that gets checked off as work actually lands. Each milestone must
build (`pnpm run build`), lint clean (`pnpm run lint`), and pass its tests
(`pnpm run test`) before the next one starts.

- [x] **Milestone 2 — Project scaffold.** Vite + React 19 + TS strict +
      Tailwind v4 + pnpm; ESLint architecture-boundary rules
      (`no-restricted-imports` for scorm-again, `eslint-plugin-boundaries`
      for feature isolation) confirmed to actually fire, not just configured;
      Vitest + RTL wired with a passing smoke test; Playwright configured
      (specs land once there's a package to test); shadcn/ui file
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
- [ ] **Milestone 7 — API Monitor, CMI Inspector, Console.** Live-updating
      panels wired to `logStore`/`runtimeStore`. *Exit criteria:* every
      SCORM API call appears in the monitor within one frame; CMI tree
      reflects live state with diff highlighting.
- [ ] **Milestone 8 — Timeline + Session Replay.** `TimelinePanel`,
      scrubbing, snapshot restore. *Exit criteria:* scrub to any point in a
      completed session and see the CMI state at that instant.
- [ ] **Milestone 9 — Breakpoints.** Breakpoint CRUD + pause/resume gate in
      the adapter. *Exit criteria:* a breakpoint on a specific `SetValue`
      element reliably pauses execution before the value is applied.
- [ ] **Milestone 10 — Validation engine.** Static (manifest) + runtime
      validators, `ValidationPanel`. *Exit criteria:* known-bad sample
      packages (missing resource, broken suspend_data, out-of-range score)
      produce the expected issues.
- [ ] **Milestone 11 — Runtime Profiles.** Strict ADL / SCORM Cloud /
      Moodle / Canvas / SuccessFactors / Cornerstone / Custom. *Exit
      criteria:* switching profile visibly changes adapter behavior against
      the same package.
- [ ] **Milestone 12 — Reports.** One-click QA report
      (JSON/CSV/Markdown/HTML export). *Exit criteria:* generated report
      contains manifest summary, runtime summary, timeline, logs, and
      renders correctly as standalone HTML.
- [ ] **Milestone 13 — Plugin system.** `PluginHost`, `PluginApi`,
      panel/command/validator registration. *Exit criteria:* a trivial
      sample plugin registers and appears in the UI without touching core
      code.
- [ ] **Milestone 14 — Storage/Network/Performance panels.** Remaining
      Advanced-Mode panels. *Exit criteria:* each panel shows real data for
      a running session.
- [ ] **Milestone 15 — Hardening.** Accessibility AA pass, Vitest coverage
      targets, Playwright e2e suite across sample packages. *Exit criteria:*
      CI green across unit + e2e; axe-core audit passes on both modes.
