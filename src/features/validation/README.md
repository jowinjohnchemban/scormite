# features/validation

Static (manifest) and runtime validators, plus the Validation panel.

Static rules live in
`services/ValidationService.ts` (pure `StaticValidator` objects over a
`ManifestValidationContext`). Runtime rules live in the runtime feature's
`validationMiddleware` (pure `RuntimeValidator` objects run on every API
call), installed by the app layer in `app/course/ScoLauncher.ts`. The
validation feature never imports runtime — issues arrive via an injected
`onIssue` callback and land in `state/validationStore.ts`, rendered by
`components/ValidationPanel.tsx`.

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
