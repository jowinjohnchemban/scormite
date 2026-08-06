# features/plugins

Plugin host, plugin API contract, and built-in plugin scaffolds (xAPI, cmi5, accessibility, AI review).

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`plugins/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
