# features/player

Sandboxed iframe player that hosts the loaded SCORM package's launch page.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`player/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
