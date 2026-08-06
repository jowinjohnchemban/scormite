# features/timeline

Event timeline visualization and session replay/scrubbing UI.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`timeline/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
