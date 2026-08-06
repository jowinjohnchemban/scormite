# features/runtime

Owns the ScormRuntimeAdapter and all scorm-again wiring. Nothing outside this feature may import scorm-again directly — go through this feature's public surface instead.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`runtime/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
