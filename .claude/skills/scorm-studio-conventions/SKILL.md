---
name: scorm-studio-conventions
description: Architecture, folder, and workflow conventions for the Scormite codebase. Use this whenever adding a feature, touching src/features/runtime or anything that talks to scorm-again, adding a new UI primitive, writing a new ESLint/architecture rule, or picking up the next roadmap milestone. Also use when the user mentions Scormite, SCORM Studio, scorm-again, CMI inspector, API monitor, breakpoints, runtime profiles, or asks "what's next" / "which milestone" for this project.
---

# Scormite Conventions

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
| **A shared entity type** (`Package`, `Manifest`, `Session`, …) | **`src/shared/types/`** — see the type-sharing pattern below |
| A new SCORM runtime profile (Moodle, Canvas, etc.) | `src/features/settings/profiles/` |
| Cross-feature orchestration (calling two feature services together) | The `app/` layer — it is the only layer allowed to import from multiple features simultaneously |

## The type-sharing pattern (established in Milestone 3)

The ESLint `boundaries/dependencies` rule currently blocks all
feature-to-feature imports — a feature cannot import another feature's
`types/` even through the barrel. Until the plugin adds a barrel-only
selector, **shared entity types live in `src/shared/types/`**, not in
individual feature `types/` folders.

```
src/shared/types/
  manifest.ts   ← Manifest, ManifestOrganization, ManifestItem, ManifestResource, ManifestMetadata
  package.ts    ← Package, ScormVersion, ScormEdition
  index.ts      ← re-exports all of the above
```

Features import from `@/shared/types`; the owning feature's `types/`
folder can remain empty or act as a thin re-export. The **service that
constructs or mutates** the entity stays in the owning feature — only the
type definition moves to shared.

## The app-layer orchestration pattern (established in Milestone 3)

When completing a user action requires calling services from two or more
features (e.g. load a ZIP *and* parse its manifest), the orchestration
belongs in `app/` — the only layer allowed to import from any feature.

```tsx
// In a BasicModeShell or app-level hook:
const raw = await loadZip(file)              // from @/features/package-loader
const manifest = parseManifest(raw.manifestXml)  // from @/features/manifest
setPackage({ ...raw, manifest })             // into packageStore
setManifest(manifest)                        // into manifestStore (feature-owned)
```

Both stores get populated separately so that each feature's components can
read their own store without importing from a sibling.

## Key libraries added in Milestone 3

| Library | Used for |
|---|---|
| `jszip` | Reading ZIP archives in the browser (`PackageLoaderService`) |
| `fast-xml-parser` | Parsing `imsmanifest.xml` (`ManifestParserService`) |

`fast-xml-parser` config gotchas:
- **`parseTagValue: false`** — without this, `<schemaversion>1.2</schemaversion>` is parsed as the number `1.2`, not the string `"1.2"`. Always set it.
- **`parseAttributeValue: false`** — keeps attribute values as strings (SCORM identifiers can look like numbers).
- **`isArray`** — always register `organization`, `item`, `resource`, `file` so you never have to branch on object-vs-array downstream.

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

## TypeScript strictness gotcha: `exactOptionalPropertyTypes`

`tsconfig.app.json` enables `exactOptionalPropertyTypes: true`. This means
`prop?: T` is strictly `T`, not `T | undefined` — you **cannot** assign
`{ prop: value | undefined }` to a type with `prop?: T`.

Use conditional spreads for optional properties:
```ts
// ✗ fails
return { scormEdition: detected.edition }   // detected.edition may be undefined

// ✓ correct
return { ...(detected.edition !== undefined ? { scormEdition: detected.edition } : {}) }
```

## Testing gotcha: RTL cleanup with `globals: false`

`vitest.config.ts` sets `globals: false`. With this setting,
`@testing-library/react` does **not** auto-register `afterEach(cleanup)` —
each test file that calls `render()` must do it explicitly:

```ts
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
```

Without this, a second `render()` in the same file sees the previous test's
DOM, causing spurious "multiple elements found" failures.

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
