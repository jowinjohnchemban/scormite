# features/session

Breakpoints: pause the course on chosen SetValue / Commit calls.

Breakpoint CRUD lives in `state/breakpointStore.ts` +
`services/BreakpointService.ts`, the UI in `components/BreakpointsPanel.tsx`.
The pause/resume gate itself lives in the runtime adapter
(`ScormRuntimeAdapter`); the session feature never imports runtime — resume is
injected by the app layer via a `ResumeHandler` (see
`app/hooks/usePackageSession.ts`).

## Public surface

Only the app layer imports this feature, and only through `index.ts`;
features never import each other. ESLint enforces both (`eslint.config.js`).
