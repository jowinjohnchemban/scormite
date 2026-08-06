# features/session

Session lifecycle, CMI snapshots, and breakpoint management.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`session/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
