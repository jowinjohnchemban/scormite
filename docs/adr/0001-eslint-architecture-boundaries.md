# ADR 0001: Enforce architecture boundaries via ESLint, not just convention

**Status:** accepted
**Date:** 2026-08-04

## Context

Two rules are load-bearing for this codebase staying maintainable at
commercial scale:

1. Only `src/features/runtime` may import `scorm-again`. Every other
   feature must go through the adapter's public surface.
2. Features may not reach into each other's internals — cross-feature
   imports must go through a feature's `index.ts` barrel (in practice,
   for now: features may depend on `shared`, `components`, and their own
   subtree, but not another feature's internals).

Documenting these as conventions in `README.md` files is necessary but not
sufficient — conventions drift as a team (or a future Claude session)
grows the codebase under deadline pressure.

## Decision

Enforce both rules with ESLint, wired into `pnpm run lint`:

- Rule 1 via the built-in `no-restricted-imports`, banning the
  `scorm-again` specifier everywhere except an override block scoped to
  `src/features/runtime/**`.
- Rule 2 via `eslint-plugin-boundaries`'s `boundaries/dependencies` rule,
  which classifies every file into an "element" (`app`, `feature`,
  `shared`, `components`) based on its path, and only allows the
  dependency edges we explicitly list.

`eslint-plugin-boundaries` needs `import/resolver` configured
(`eslint-import-resolver-typescript`, pointed at `tsconfig.app.json`) to
actually resolve relative/aliased imports to a classified element — without
a resolver it silently treats every import as "unknown" and never fires.
This is not obvious from the plugin's own quick-start docs; it only became
apparent once a deliberately-broken test import (`manifest` reaching into
`player`'s internals) kept passing lint with zero errors.

## Consequences

- A regression in either rule fails CI (`pnpm run lint`), not just code
  review — the failure mode changes from "someone missed it in review"
  to "the build doesn't pass."
- Anyone extending the architecture (adding a new "element" type, changing
  which folders can depend on which) has to update `eslint.config.js`, not
  just a README. That's the point, but it does mean the config is the
  actual source of truth for the rules, and this ADR + `docs/ARCHITECTURE.md`
  are the explanation, not a duplicate ruleset.
- `eslint-plugin-boundaries` v7's API is still settling (the `element-types`
  → `dependencies` rename, `rules` → `policies`, `${...}` → `{{...}}`
  template syntax) — expect another migration if/when it hits a stable
  major. Re-verify with a deliberate violation test (see the pattern used
  during scaffolding: temporarily import across a feature boundary, confirm
  lint fails, then remove the test file) any time the plugin is upgraded.

## Alternatives considered

- **Convention only (README + code review).** Rejected — doesn't survive
  scale or time pressure, and this is explicitly meant to become a
  commercial-grade codebase.
- **A custom ESLint rule instead of `eslint-plugin-boundaries`.** More
  control, but more to maintain ourselves for a rule that's already a
  solved, actively-maintained problem elsewhere. Revisit only if the
  plugin's API instability becomes a recurring cost.
- **Nx / Turborepo module boundaries.** Real option if this becomes a
  monorepo with genuinely separate packages later; overkill for a
  single-package feature-first app right now.
