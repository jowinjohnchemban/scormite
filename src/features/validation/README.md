# features/validation

Static (manifest) and runtime validators, plus the Validation panel.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`validation/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
