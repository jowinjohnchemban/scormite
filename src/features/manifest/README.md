# features/manifest

Parses imsmanifest.xml (via fast-xml-parser) into the Manifest tree model and renders the Manifest Explorer.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
