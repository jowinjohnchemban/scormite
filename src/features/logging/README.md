# features/logging

API Monitor and Console panels, plus log export (JSON/CSV/Markdown/HTML).

`ApiMonitorPanel` and `ConsolePanel` render the runtime call stream owned by
`logStore`. The app-level package-session hook subscribes to runtime events and
writes records into that store, keeping this feature independent of runtime
implementation details.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`logging/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
