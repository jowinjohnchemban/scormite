# features/package-loader

ZIP/folder ingestion, drag and drop, and SCORM version/manifest detection.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`package-loader/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
