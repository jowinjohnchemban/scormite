# features/reports

One-click QA report generation and export.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
