# features/logging

The API Log panel: every SCORM API call the course made, with per-method
counts, a failed-only filter, and scorm-again's explanation of each error.

`ApiMonitorPanel` renders the runtime call stream owned by `logStore`. The app-level package-session hook subscribes to runtime events and
writes records into that store, keeping this feature independent of runtime
implementation details.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`logging/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
