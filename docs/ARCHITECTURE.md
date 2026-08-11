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
