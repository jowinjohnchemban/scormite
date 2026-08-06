# **SCORMITE** <br> SCORM Interactive Testing Environment

**DevTools for your SCORM package.** Drop a `.zip` and Scormite runs it locally — surfacing a live API transcript, the full CMI data model, sequencing logic, validation findings, and session replay. No LMS. No upload. No black box.

Compatibility benchmark: **SCORM Cloud.**  UX benchmark: **VS Code + Chrome DevTools.**  
Runtime: [scorm-again](https://github.com/jcputney/scorm-again) — wrapped, never modified.

---

## Privacy

Your packages never leave your machine. ZIP parsing, manifest analysis, and package execution all run entirely in the browser. No server round-trip. No account. No telemetry.

---

## Features

| | Feature | Status |
|---|---|---|
| 01 | **Manifest explorer** — parse `imsmanifest.xml`, inspect the organization tree and resource list, detect SCORM version | ✅ Milestone 3 |
| 02 | **Sandboxed iframe player** — launch SCOs in a sandboxed iframe, reload, reset, fullscreen | 🔜 Milestone 5 |
| 03 | **API transcript** — every `Initialize`, `GetValue`, `SetValue`, `Commit`, `Terminate` in order, with arguments, return codes, and timing | 🔜 Milestone 7 |
| 04 | **CMI inspector** — live CMI data model tree with diff highlighting on every `SetValue` | 🔜 Milestone 7 |
| 05 | **Timeline + session replay** — scrub to any point in a completed session and see the CMI state at that instant | 🔜 Milestone 8 |
| 06 | **Breakpoints** — pause execution *before* a specific `SetValue` fires, inspect state, then resume | 🔜 Milestone 9 |
| 07 | **Validation** — static manifest lint + runtime rule violations, each with a severity and rule ID | 🔜 Milestone 10 |
| 08 | **Runtime profiles** — switch between SCORM Cloud, Moodle, Canvas, SuccessFactors, Cornerstone, or a custom config to reproduce LMS-specific behaviour | 🔜 Milestone 11 |
| 09 | **QA report** — one-click export of manifest summary, runtime log, timeline, and validation findings as JSON / CSV / Markdown / standalone HTML | 🔜 Milestone 12 |
| 10 | **Plugin system** — register custom panels, validators, and commands without touching core code | 🔜 Milestone 13 |

---

## Getting started

```bash
pnpm install
pnpm run dev        # start the dev server
pnpm run build      # production build
pnpm run lint       # ESLint + architecture boundary checks
pnpm run typecheck  # tsc --noEmit
pnpm run test       # Vitest unit/component tests
pnpm run e2e        # Playwright e2e (needs `pnpm exec playwright install` first)
pnpm run format     # Prettier
```

Requires pnpm (see `packageManager` in `package.json`).

---

## Documentation

- `CLAUDE.md` — rules and workflow for any AI or human picking up development
- `docs/ARCHITECTURE.md` — layering, folder structure, tooling decisions
- `docs/DOMAIN_MODEL.md` — canonical entity list and feature ownership
- `docs/ROADMAP.md` — milestone-by-milestone plan with exit criteria
- `docs/adr/` — architecture decision records
- `src/features/<name>/README.md` — what each feature owns

---

## Architecture

```
UI (React)  →  Studio Services  →  Runtime Adapter  →  scorm-again  →  SCORM Package
```

Two rules enforced by ESLint (not just convention):

1. Only `src/features/runtime` may import `scorm-again`.
2. Features cannot reach into another feature's internals — only `app`, `shared`, `components`, and same-feature imports are allowed across feature boundaries.

See `docs/adr/0001-eslint-architecture-boundaries.md` for how these work and one gotcha worth knowing if you touch that config.

