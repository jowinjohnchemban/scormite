# Progress Notes — Short-term

Date: 2026-08-11

Summary
-------

- Implemented project-level SEO/static-file support and a small Vite plugin
  to generate `robots.txt`, `sitemap.xml`, and `llms.txt` during build and
  to serve the same files during local dev. This lives in `vite.config.ts` and
  is driven by `src/shared/config/seo.ts`.
- Milestone 13 — Plugin system: `src/features/plugins/` owns the plugin host
  (`usePluginHost` Zustand store), the `ScormitePlugin` contract in
  `types.ts`, and the built-in `samplePlugin.ts`. A plugin's `activate(api)`
  can only register contributions (panels, commands, validators) — never
  touch core internals. The app layer bridges contributions into the dock
  (`usePluginPanels`), toolbar (`PluginMenu`), and validation middleware
  (`pluginHostBridge`) without any feature-to-feature imports. Verified in
  the browser: the sample plugin's panel appears in the Panels menu, opens
  in the Bottom dock, and its toolbar command logs to the console — with
  zero core-code changes and zero console errors.
- Fixed two pre-existing console floods (not from M13, surfaced while
  testing): (1) "Maximum update depth exceeded" loop caused by an unstable
  `handleAdvancedCenterRect` callback recreated per render while listed in
  `DockLayout`'s effect deps — fixed with `useCallback` in `App.tsx`;
  (2) zustand v5 "getSnapshot should be cached" loop caused by selecting
  `Object.values(s.plugins)` (fresh array each call) — fixed by selecting
  the stable slice and deriving in the component body.

Files changed
-------------

- `src/features/plugins/types.ts` — plugin contract + contribution types.
- `src/features/plugins/registry/PluginHost.ts` — `usePluginHost` store.
- `src/features/plugins/builtin/samplePlugin.ts` — reference implementation.
- `src/features/plugins/builtin/SamplePluginPanel.tsx` — sample panel UI.
- `src/features/plugins/index.ts` — barrel.
- `src/app/plugins/pluginHostBridge.ts` — startup registration + validator bridge.
- `src/app/plugins/usePluginPanels.ts` — panel contributions → dock registry.
- `src/app/plugins/PluginMenu.tsx` — toolbar command menu.
- `src/app/App.tsx` — `registerBuiltinPlugins()` at startup; `useCallback` fix.
- `src/app/modes/AdvancedModeShell.tsx`, `src/app/layout/TopToolbar.tsx`,
  `src/app/hooks/usePackageSession.ts` — wiring.
- `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md` — plugin entities.

What works now
-------------

- `pnpm run build` emits `dist/robots.txt`, `dist/sitemap.xml`, and
  `dist/llms.txt` with values taken from `siteSeoConfig`.
- Dev server (`pnpm run dev`) serves the same endpoints at `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.
- A trivial sample plugin registers and appears in the UI (Panels menu →
  Bottom dock panel, Plugins menu → command) without touching core code;
  its validator contribution flows into the runtime validation pipeline.
- Advanced mode is console-error-free.

## Milestone 14 — Storage/Network/Performance panels (2026-08-11)

- Package Explorer (`src/features/package-loader/components/PackageExplorerPanel.tsx`):
  left-dock tree of extracted package files with expand/collapse, launch-file
  badge, and the `FileTreeView` subcomponent keyed by `pkg.id` (avoids
  `react-hooks/set-state-in-effect` by letting React remount the tree).
  Tree-building logic is pure and tested in
  `src/features/package-loader/services/fileTree.ts` (`FileTreeNode[]`).
- Network panel (`src/features/player/components/NetworkPanel.tsx`): live
  package-file request log fed by `networkMonitor.ts`, which listens for
  `FETCH_EVENT` postMessages from the service worker. Cache hit/miss,
  HTTP status, duration ms; entries live in the `useNetworkStore`
  (`NetworkEntry`). `public/sw.js` now activates immediately
  (`skipWaiting` + `clients.claim`) and broadcasts each package-file fetch
  to ALL window clients — crucial because the SCO runs in a sandboxed
  iframe, so `event.clientId` alone would never reach the app UI.
- Storage panel (`src/features/storage/`, new feature): inspects Cache
  Storage buckets, `localStorage` items, and global quota via
  `StorageService` (`StorageEntry`/`StorageReport`, `formatBytes`) with
  `storageStore` + `StoragePanel`. This is a browser/devtools-style panel,
  not an LMS data store — read-only inspection.
- Performance panel (`src/features/logging/components/PerformancePanel.tsx`):
  aggregates `ApiCallRecord`s via
  `src/features/logging/services/performanceMetrics.ts` into
  `PerformanceMetrics` — total, errors, avg, P95, max ms, top-5 slowest
  calls, per-method breakdown.
- `src/app/layout/panels.ts` `ADVANCED_PANELS` now registers real
  components for Package / Network / Storage / Performance; all Milestone
  14 placeholders are gone.
- Verified in browser against the running `scormite-sample` SCO: file tree
  (3 files, launch badge on `index.html`), Network (3 requests, 3 cache
  hits), Storage (3 Cache buckets, 9 localStorage keys, quota estimate),
  Performance (18 calls, avg 0.8 ms, P95 5.4 ms). All three quality gates
  pass: `pnpm run lint` (0 warnings), `pnpm run typecheck`, `pnpm run build`.

Next steps (later continuation)
-------------------------------

1. Milestone 15 — Hardening: accessibility AA pass (axe-core audit on both
   modes; ARIA labels, contrast, keyboard focus, screen-reader landmarks).
2. Wire `siteUrl` to CI/deploy environment via `VITE_SITE_URL` or `SITE_URL`.
3. Expand `routes` to include any dynamic/public routes (e.g., per-package
   landing pages) to make a complete `sitemap.xml`.
4. Consider pulling `llms` from a maintained config or remote source if it
   needs to be updated without a deploy.
5. Add a small test that validates `dist/` contains the expected files in CI.
6. Optionally, expose site metadata into the React app's head tags centrally
   so runtime meta changes reflect `siteSeoConfig`.
