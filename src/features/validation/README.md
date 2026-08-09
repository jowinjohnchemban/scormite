# features/validation

Static (manifest) and runtime validators, plus the Validation panel.

Validation landed in Milestone 10. Static rules live in
`services/ValidationService.ts` (pure `StaticValidator` objects over a
`ManifestValidationContext`), runtime rules live in the runtime feature's
`validationMiddleware` (pure `RuntimeValidator` objects re-read per API call,
so Milestone 11 profiles can toggle them). The middleware is injected by the
app layer in `app/hooks/usePackageSession.ts`; the validation feature never
imports runtime — issues arrive via an injected `onIssue` callback and land in
`state/validationStore.ts`, rendered by `components/ValidationPanel.tsx`.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`validation/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
