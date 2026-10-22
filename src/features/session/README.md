# features/session

Breakpoints: pause the course on chosen SetValue / Commit calls.

Breakpoints landed in Milestone 9: CRUD lives in `state/breakpointStore.ts` +
`services/BreakpointService.ts`, the UI in `components/BreakpointsPanel.tsx`.
The pause/resume gate itself lives in the runtime adapter
(`ScormRuntimeAdapter`); the session feature never imports runtime — resume is
injected by the app layer via a `ResumeHandler` (see
`app/hooks/usePackageSession.ts`).

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`session/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).
