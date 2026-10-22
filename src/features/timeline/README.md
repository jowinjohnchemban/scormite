# features/timeline

The CMI History panel: every change to the data model during the current
launch, scrubbable — the CMI Inspector shows the state at the chosen point.

## Public surface

Import from other features only via this folder's `index.ts` barrel — never reach into
`timeline/**/internal` paths directly. This boundary is enforced by ESLint
(`eslint-plugin-boundaries`, see `eslint.config.js`).

## What this feature owns

- `useTimelineStore` — the recorded `CmiSnapshot[]` for the current session plus the
  replay cursor position. `captureSnapshot` diffs each snapshot against the previous
  one and ignores no-op state (`changedPaths` empty), so every snapshot marks a real
  CMI change.
- `TimelinePanel` (titled CMI History) — slider + per-snapshot scrub list; scrubbing never touches the
  running SCO.

## Boundaries

Timeline cannot reach into the inspector (no feature-to-feature imports). The
scrub → CMI Inspector bridge lives in `app/hooks/useTimelineReplay.ts`, and snapshot
capture is driven by `app/hooks/usePackageSession.ts` on each runtime `api-call`
event.
