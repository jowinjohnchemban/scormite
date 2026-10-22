# features/inspector

CMI Inspector: the live CMI data model, filterable, with the fields changed
since launch marked. Read-only — the SCO is the only writer.

`CmiInspectorPanel` reads the inspector-owned snapshot store. The app-level
package-session hook supplies CMI snapshots after runtime events, so this
feature does not depend directly on the runtime feature.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`inspector/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
