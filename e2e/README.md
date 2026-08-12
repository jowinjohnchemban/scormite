# End-to-end tests (Playwright)

Drive the real app in a real browser (Chromium) against the Vite dev server:
load sample SCORM packages through the drop zone, verify the manifest tree,
the persistent player iframe (served through the service worker), live CMI
updates, and Basic ↔ Advanced mode switches.

## Running

```bash
pnpm run test:e2e            # run once (starts the dev server automatically)
pnpm exec playwright test --ui   # interactive UI
pnpm exec playwright show-report # view the last HTML report
```

Requires a one-time browser install: `pnpm exec playwright install chromium`.

## Fixtures

The zips in `e2e/fixtures/` are **committed** so CI never needs to generate
them or touch the network. Regenerate them with:

```bash
node scripts/make-fixtures.mjs
```

Each fixture is a minimal spec-correct SCORM package whose SCO talks to the
runtime through the standard API surface (`window.parent.API` for 1.2,
`window.parent.API_1484_11` for 2004) and writes its results into the
document body so specs can assert the full pipeline ran. File dates are
pinned, so regenerating produces byte-identical zips.

## Conventions

- Specs must not require network access beyond the local dev server.
- Assert on the app's rendered output (sidebar, CMI summary, dock panels)
  rather than internal state.
- Keep assertions scoped to avoid strict-mode collisions (e.g. `completed`
  appears in multiple CMI rows — scope to the row label).
