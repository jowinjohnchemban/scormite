# features/runtime

Owns the ScormRuntimeAdapter and all scorm-again wiring. Nothing outside this feature may import scorm-again directly — go through this feature's public surface instead.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
