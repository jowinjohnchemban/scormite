# e2e/

Playwright specs. Empty for now — real specs need a loadable SCORM package,
which lands in Milestone 3 (Package loader + Manifest parser). See
`/docs/ROADMAP.md`.

Run with `pnpm exec playwright install` (one-time, downloads browsers — not
run in this sandbox since it needs a network domain that isn't allow-listed
here) followed by `pnpm run e2e`.
