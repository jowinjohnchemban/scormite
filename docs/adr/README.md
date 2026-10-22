# Architecture decision records

Why the project's non-obvious or debatable technical choices were made. A
record is written when a choice could reasonably have gone another way — a
new dependency direction, a new boundary rule, a library swap — so the
reasoning outlives the commit that introduced it.

| Record                                                                                      | Status   |
| ------------------------------------------------------------------------------------------- | -------- |
| [0001 — Enforce architecture boundaries via ESLint](0001-eslint-architecture-boundaries.md) | Accepted |

## Adding a record

1. Copy [template.md](template.md) to `NNNN-short-title.md`, numbering on
   from the last record.
2. Fill in context, decision, consequences, and the alternatives
   considered. Start it as `proposed`; mark it `accepted` when the change
   lands.
3. Add it to the table above in the same change.

Records are not rewritten when a decision changes: write a new record and
mark the old one `superseded by ADR NNNN`.
