# SCORM Studio

An offline-first, browser-based developer toolkit for inspecting, debugging,
validating, and testing SCORM packages. Not an LMS, not an authoring tool —
think Chrome DevTools / VS Code / Postman, but for SCORM.

Built on [scorm-again](https://github.com/jcputney/scorm-again) as the
runtime; SCORM Studio wraps it with an adapter + middleware layer rather
than reimplementing any SCORM protocol logic.

## Status

Milestone 2 (project scaffold) complete. See `docs/ROADMAP.md` for what's
next and `milestones/01-architecture-and-design.md` for the full original design doc
(architecture, domain model, wireframes, component hierarchy, runtime
adapter design).

## Getting started

```bash
pnpm install
pnpm run dev        # start the dev server
pnpm run build       # production build
pnpm run lint        # ESLint, including architecture boundary checks
pnpm run typecheck   # tsc --noEmit
pnpm run test         # Vitest unit/component tests
pnpm run e2e          # Playwright e2e (needs `pnpm exec playwright install` first)
pnpm run format       # Prettier
```

Requires pnpm (see `packageManager` in `package.json`).

## Documentation

- `CLAUDE.md` — rules and workflow for any Claude session (or human)
  working in this repo. Read this first if you're picking up development.
- `docs/ARCHITECTURE.md` — layering, folder structure, tooling
- `docs/DOMAIN_MODEL.md` — core entities and which feature owns each
- `docs/ROADMAP.md` — milestone-by-milestone plan with exit criteria
- `docs/adr/` — architecture decision records
- Each `src/features/<name>/README.md` — what that feature owns

## Architecture at a glance

```
UI (React) → Studio Services → Runtime Adapter → scorm-again → SCORM Package
```

Two rules are enforced by ESLint, not just convention:

1. Only `src/features/runtime` may import `scorm-again`.
2. Features cannot import each other's internals — only `app`, `shared`,
   `components`, and same-feature imports cross a feature boundary.

See `docs/adr/0001-eslint-architecture-boundaries.md` for how these are
enforced and a gotcha worth knowing about if you touch that config.
