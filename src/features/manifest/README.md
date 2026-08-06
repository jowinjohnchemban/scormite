# features/manifest

Parses imsmanifest.xml (via fast-xml-parser) into the Manifest tree model and renders the Manifest Explorer.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`manifest/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
