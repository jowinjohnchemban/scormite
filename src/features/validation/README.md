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

Import from other features only via this folder's `index.ts` barrel — never reach into
`validation/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
