# features/player

Sandboxed iframe player that hosts the loaded SCORM package's launch page.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
