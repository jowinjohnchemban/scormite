# features/reports

One-click QA report generation and export.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`reports/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
