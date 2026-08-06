# features/inspector

CMI Inspector: live tree view, diffing, and editing of the CMI data model.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`inspector/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
