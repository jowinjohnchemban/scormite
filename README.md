# **SCORMITE** <br> SCORM Interactive Testing Environment

**DevTools for your SCORM package.** Drop a `.zip` and Scormite runs it locally — playing every SCO, surfacing a live API transcript, the full CMI data model, validation findings, and session replay. No LMS. No upload. No black box.

Compatibility benchmark: **SCORM Cloud.**  UX benchmark: **VS Code + Chrome DevTools.**  
Runtime: [scorm-again](https://github.com/jcputney/scorm-again) — wrapped, never modified.

---

## Privacy

Your packages never leave your machine. ZIP parsing, manifest analysis, and package execution all run entirely in the browser. No server round-trip. No account. No telemetry.

---

## Features

| | Feature |
|---|---|
| 01 | **SCORM 1.2 and SCORM 2004** (2nd / 3rd / 4th Edition) runtimes via scorm-again; SCORM 1.1 packages run on the 1.2 API |
| 02 | **Course player** — sandboxed iframe, course outline for multi-SCO packages, previous / next, SCORM 2004 navigation requests (`continue`, `previous`, `choice`, `jump`) followed |
| 03 | **Resume testing** — relaunch a SCO from its stored attempt (`entry=resume`, suspend_data, location, score), start a new attempt, or restart the whole course |
| 04 | **LMS launch data** — mastery score, launch data, time limits, completion threshold and passing score from the manifest are seeded like an LMS would |
| 05 | **API transcript** — every `Initialize`, `GetValue`, `SetValue`, `Commit`, `Terminate` with arguments, return value, timing, and scorm-again's error explanation |
| 06 | **CMI inspector** — live CMI data model with change highlighting |
| 07 | **Timeline replay** — scrub to any point of a session and see the CMI state at that instant |
| 08 | **Breakpoints** — pause *before* a specific `SetValue` is applied, inspect, resume |
| 09 | **Validation** — manifest checks (missing files, broken refs, duplicate ids, manifest not at the zip root) and runtime checks (out-of-range score, oversized suspend_data, missing commit) |
| 10 | **QA report** — HTML / Markdown / JSON / CSV export of the session |
| 11 | **Package / Network / Performance panels** — file tree, service-worker fetches, API call timings |

---

## Getting started

```bash
pnpm install
pnpm run dev        # start the dev server
pnpm run build      # production build
pnpm run lint       # ESLint + architecture boundary checks
pnpm run typecheck  # tsc --noEmit
pnpm run test       # vitest (unit + axe-core accessibility audits)
pnpm run test:coverage  # vitest with coverage thresholds (35/20/30/35)
pnpm run test:e2e   # Playwright e2e suite (Chromium)
pnpm run format     # Prettier
```

Requires pnpm (see `packageManager` in `package.json`).

## Deployment

Deploy to Vercel, Cloudflare, or any Docker-compatible host using the checked-in
configuration files. See [deployment instructions](docs/DEPLOYMENT.md).

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
