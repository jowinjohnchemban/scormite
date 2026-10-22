# features/inspector

CMI Inspector: the live CMI data model, filterable, with the fields changed
since launch marked. Read-only — the SCO is the only writer.

`CmiInspectorPanel` reads the inspector-owned snapshot store. The app-level
package-session hook supplies CMI snapshots after runtime events, so this
feature does not depend directly on the runtime feature.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
