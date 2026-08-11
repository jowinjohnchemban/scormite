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

## Plugins

`src/features/plugins/` owns the plugin host: `usePluginHost` (Zustand
store) holds registered plugins plus their panel/command/validator
contributions, `types.ts` defines the `ScormitePlugin` contract, and
`builtin/samplePlugin.ts` is the reference implementation. A plugin is
self-contained — its `activate(api)` receives a `PluginApi` that can only
register contributions, never touch core internals. The app layer
(`src/app/plugins/`) bridges contributions into the dock (`usePluginPanels`)
and toolbar (`PluginMenu`), and feeds validator contributions into the
runtime validation middleware (`pluginHostBridge`). Plugins register once,
at app startup, before any package can load.

## Advanced-Mode inspection panels (M14)

Four panels complete the Advanced-Mode dock, all fed by real data:

- **Package Explorer** (`package-loader`): pure tree-building logic in
  `services/fileTree.ts`; `PackageExplorerPanel` renders it with a
  launch-file badge. The tree view is a subcomponent keyed by `pkg.id` so
  React remounts it per package instead of setting state in an effect.
- **Network** (`player`): the service worker (`public/sw.js`) broadcasts a
  `FETCH_EVENT` message (path, cache hit/miss, HTTP status, duration ms)
  for every package-file fetch to **all window clients** via
  `self.clients.matchAll({ type: 'window' })` — the SCO lives in a
  sandboxed iframe, so `event.clientId` alone would never reach the app
  UI. `networkMonitor.ts` listens on the window side and records into
  `useNetworkStore`; `NetworkPanel` renders the live log. The SW activates
  immediately (`skipWaiting` + `clients.claim`).
- **Storage** (`storage` feature): read-only browser-storage inspector —
  Cache Storage buckets, `localStorage` items, and global quota estimate
  via `StorageService` → `storageStore` → `StoragePanel`.
- **Performance** (`logging`): `performanceMetrics.ts` aggregates
  `ApiCallRecord`s (total, errors, avg, P95, max ms, top-5 slowest,
  per-method breakdown); `PerformancePanel` renders the cards.

All four are registered as real components in `src/app/layout/panels.ts`
(`ADVANCED_PANELS`); no placeholder panels remain.

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
