---
name: scorm-studio-conventions
description: Architecture, folder, and workflow conventions for the SCORM Studio codebase. Use this whenever adding a feature, touching src/features/runtime or anything that talks to scorm-again, adding a new UI primitive, writing a new ESLint/architecture rule, or picking up the next roadmap milestone. Also use when the user mentions SCORM Studio, scorm-again, CMI inspector, API monitor, breakpoints, runtime profiles, or asks "what's next" / "which milestone" for this project.
---

# SCORM Studio Conventions

This skill captures the operating rules for this specific codebase, distinct
from general React/TypeScript best practice. Read `/CLAUDE.md` at the repo
root first — it's the shorter, canonical version of this. This skill exists
so the rules also surface when Claude is working inside a subfolder and
hasn't necessarily read the root file this session.

## The one rule that matters most

**scorm-again is the runtime. Everything else wraps it.** Never write SCORM
protocol logic by hand. If you find yourself parsing CMI element paths,
tracking Initialize/Terminate state, or validating data-model values against
the SCORM spec outside of `src/features/runtime/adapter/`, stop — that
logic belongs in scorm-again or in a middleware wrapping it, not in a new
implementation.

## Where things go

| If you're adding... | It goes in... |
|---|---|
| Anything that calls scorm-again directly | `src/features/runtime/adapter/` only |
| A new middleware (breakpoints, recording, validation, replay) | `src/features/runtime/adapter/middleware/`, implementing `RuntimeMiddleware` |
| A new panel for Advanced Mode | The owning feature's `components/`, registered via `PanelRegistry` (once that exists — Milestone 6+) |
| A new Zustand store | Inside the feature that owns that data — see `docs/DOMAIN_MODEL.md` for current ownership |
| A shared, dumb UI primitive (button, dialog, etc.) | `src/components/ui/`, following the shadcn/ui file shape (cva variants + `cn()`) |
| A cross-feature utility with no UI | `src/shared/lib/` |
| A new SCORM runtime profile (Moodle, Canvas, etc.) | `src/features/settings/profiles/` |

## Before writing code: check the roadmap

Open `docs/ROADMAP.md`. Find the current milestone (first unchecked box).
Its "exit criteria" line defines what "done" means — build a complete,
working slice that meets that bar, not a partial implementation of several
future milestones at once. If asked to "continue" or "keep building" with
no further specifics, this is where to look for what's next.

## Before writing code: check the domain model

Open `docs/DOMAIN_MODEL.md` for the canonical entity list and which feature
owns each one. Don't invent a new shape for `Session`, `ApiCallRecord`, etc.
if one is already defined — extend it in place and update the doc.

## The two ESLint-enforced boundaries

1. `no-restricted-imports` bans importing `scorm-again` outside
   `src/features/runtime/**`.
2. `eslint-plugin-boundaries` (`boundaries/dependencies` rule) bans one
   feature importing another feature's internals — only `app`, `shared`,
   `components`, and same-feature imports are allowed.

Both are real, working rules (not aspirational config) — see
`docs/adr/0001-eslint-architecture-boundaries.md` for why that distinction
mattered here specifically (the boundaries plugin silently no-ops without
`eslint-import-resolver-typescript` configured). **If you add or change an
architectural rule, prove it fires**: write a deliberate one-line violation
in a scratch file, run `pnpm run lint`, confirm it fails, then delete the
scratch file. Do not consider a new rule done until you've watched it
reject something.

## Definition of done for any change here

```bash
pnpm run lint       # must be clean, includes architecture checks
pnpm run typecheck
pnpm run test
pnpm run build
```

All four, every time, before considering a change complete — not just
"the file I was editing compiles."

## Package manager

pnpm only. Don't run plain `npm install` (it'll happily create a
`package-lock.json` next to the pnpm lockfile and cause drift) — use
`pnpm add` / `pnpm add -D`.

## Writing quality bar

Never placeholder implementations or mock data unless the user explicitly
asked for a stub. Every component ships with types; tests and doc updates
land in the same change as the feature, not deferred. This is meant to
become a commercial product, not a demo.
