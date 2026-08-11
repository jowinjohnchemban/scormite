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

Next steps (later continuation)
-------------------------------

1. Milestone 14 — Storage/Network/Performance panels (replace the
   `makePlaceholderPanel('Performance', 'Milestone 14')` placeholders in
   `src/app/layout/panels.ts`).
2. Wire `siteUrl` to CI/deploy environment via `VITE_SITE_URL` or `SITE_URL`.
3. Expand `routes` to include any dynamic/public routes (e.g., per-package
   landing pages) to make a complete `sitemap.xml`.
4. Consider pulling `llms` from a maintained config or remote source if it
   needs to be updated without a deploy.
5. Add a small test that validates `dist/` contains the expected files in CI.
6. Optionally, expose site metadata into the React app's head tags centrally
   so runtime meta changes reflect `siteSeoConfig`.
