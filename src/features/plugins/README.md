# features/plugins

The plugin system (Milestone 13): a host registry, a dependency-free plugin
contract, and built-in plugins that prove the surface works end-to-end.

## What lives here

- `types.ts` — the plugin contract: `ScormitePlugin`, `PluginApi`, and the
  contribution shapes (panel / command / validator). Plugins must never
  import another feature, so this contract deliberately mirrors core types
  (dock regions, validation results) instead of importing them.
- `registry/PluginHost.ts` — `usePluginHost`, the zustand registry that owns
  plugins and their contributions. `registerPlugin` activates a plugin by
  handing it a `PluginApi` that stamps `pluginId` onto every contribution.
- `builtin/samplePlugin.ts` — the Milestone 13 exit-criteria plugin: one
  panel, one command, one validator, written exactly like a third-party
  plugin would be.

## How contributions reach the UI

The plugins feature is UI-surface-agnostic; the app layer does the wiring
in `src/app/plugins/` because it needs to touch features this feature may
not import:

- panels → `usePanelRegistry` (dock) via `useRegisterPluginPanels`
- commands → toolbar via `PluginMenu`
- validators → the runtime validation middleware via `pluginRuntimeValidators`

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`plugins/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
