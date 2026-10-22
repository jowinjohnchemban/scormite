# Development

How to work on SCORMite — for people and AI agents alike: the product
principles, setup, the rules the build enforces, the conventions the code
follows, and what "done" means for a change.

## Product principles

- SCORMite is a developer and QA tool for SCORM packages — think Chrome
  DevTools or Postman for SCORM. It is **not** an LMS and **not** an
  authoring tool. SCORM Cloud is the compatibility benchmark, VS Code the UX
  benchmark, Chrome DevTools the debugging benchmark.
- It is built for commercial release: production code, no prototypes.
- **Only real features.** Nothing that implies behaviour the product does
  not have (no unverified "LMS emulation", no placeholder panels, no mock
  data unless a task explicitly asks for it). When the runtime cannot do
  something faithfully, say so in the UI and the docs instead of
  approximating.
- Packages never leave the browser.

## Setup

```bash
pnpm install            # pnpm only — the version is pinned in package.json
pnpm run dev            # Vite dev server on http://localhost:5173
```

| Command                              | Purpose                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run lint`                      | ESLint, including the architecture boundary rules                                                                                         |
| `pnpm run format` / `format:check`   | Prettier (`.prettierrc.json`: no semicolons, single quotes, 120 columns); CI runs the check                                               |
| `pnpm run typecheck`                 | `tsc -b --noEmit` across app, Node, and e2e configs                                                                                       |
| `pnpm run build`                     | Production build into `dist/` (also emits robots.txt, sitemap.xml, llms.txt, llms-full.txt, manifest.webmanifest, and the published docs) |
| `pnpm run test`                      | Vitest unit tests, including axe-core accessibility audits                                                                                |
| `pnpm run test:coverage`             | Unit tests with enforced coverage thresholds                                                                                              |
| `pnpm run test:e2e`                  | Playwright end-to-end suite in Chromium against committed fixture packages                                                                |
| `node scripts/make-fixtures.mjs`     | Regenerate the e2e fixture packages (byte-stable)                                                                                         |
| `node scripts/make-brand-assets.mjs` | Regenerate the logo SVGs, app icons, and social preview image from the mark's geometry                                                    |

Use `pnpm add` / `pnpm add -D` for dependencies; never commit a
`package-lock.json` or `yarn.lock`.

Dependabot (`.github/dependabot.yml`) opens grouped PRs every Monday: one
for all minor and patch releases, one per major, one for security fixes, and
one for GitHub Actions. Merge them only when CI is green; `@types/node`
majors are skipped because it follows the Node version CI runs (24).
When `@playwright/test` moves, move the e2e job's
`mcr.microsoft.com/playwright` image tag in `.github/workflows/ci.yml` to the
same version — Dependabot does not update it.

## Rules the build enforces

1. **scorm-again is the runtime.** All SCORM behaviour comes from the
   `scorm-again` package, which is never modified. SCORMite never
   re-implements runtime logic (CMI validation, status derivation,
   sequencing); it configures scorm-again, wraps it with middleware, and
   plays the LMS around it.
2. **Only `src/features/runtime` imports `scorm-again`** — enforced by
   `no-restricted-imports`. Other code reaches the runtime through
   `@/features/runtime`.
3. **Features do not import each other.** A feature may import from
   `shared`, `components`, and itself; anything that needs two
   features at once lives in `src/app/`. Enforced by
   `eslint-plugin-boundaries`; see
   [ADR 0001](adr/0001-eslint-architecture-boundaries.md).

When you add or change an architecture rule, prove it fires: write a
deliberate violation, confirm `pnpm run lint` rejects it, then delete it. A
rule that only looks right in config gives false confidence.

## Workflow

1. Read [Architecture](architecture.md) for the current layering and folder
   structure, and the [Roadmap](roadmap.md) for what is next and what
   "done" means for it. Finish one milestone — building, linting, and
   testing clean — before starting the next.
2. New feature folders follow an existing `src/features/*/README.md`
   (ownership description) and expose only an `index.ts` barrel.
3. Architecturally debatable choices (a new dependency direction, a new
   boundary element type, a library swap) get a
   [decision record](adr/README.md) — not just a commit message.
4. Tests and documentation land in the same change as the feature;
   documents follow [Writing these documents](README.md#writing-these-documents).
5. Agents keep their own working notes (progress logs, research scratch) in
   `.agent-docs/`, which is git-ignored. Anything others need belongs here
   in `docs/`.

## Where code goes

| Adding…                                                    | Goes in…                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Anything that calls scorm-again                            | `src/features/runtime/adapter/`                                                                    |
| Runtime middleware (recording, breakpoints, validation, …) | `src/features/runtime/adapter/middleware/`, implementing `RuntimeMiddleware`                       |
| Manifest parsing (including sequencing)                    | `src/features/manifest/services/`                                                                  |
| A dock panel for Advanced mode                             | The owning feature's `components/`, registered in `src/app/layout/panels.ts`                       |
| A Zustand store                                            | The feature that owns the data (see [Domain model](domain-model.md))                               |
| A shared UI primitive                                      | `src/components/ui/`, in the shadcn/ui shape (cva variants + `cn()`)                               |
| A cross-feature utility without UI                         | `src/shared/lib/`                                                                                  |
| A type used by more than one feature                       | `src/shared/types/`                                                                                |
| Logic that joins several features                          | `src/app/` (for course playback: `src/app/course/`)                                                |
| A new feature                                              | `src/features/<name>/` with a `README.md` and an `index.ts` barrel that is its only public surface |

### Shared entity types

The boundary rule blocks one feature from importing another's `types/`, so
entities used across features (`Package`, `Manifest`, `LaunchableItem`,
sequencing definitions, `ApiCallRecord`, …) are defined in
`src/shared/types/` and re-exported from its `index.ts`. The service that
constructs or mutates an entity still lives in the owning feature.

### Orchestration in the app layer

When one user action needs several features — load a zip, parse its
manifest, cache its files, start a runtime — the orchestration lives in
`src/app/`. Each feature's store is populated separately, so each feature's
components read only their own store. Course playback is modelled as
classes (`CourseSession`, `ScoLauncher`, `CourseNavigator`, `AttemptStore`);
React hooks are thin glue around them.

## Style

- Feature-first, not layer-first; composition over large components — no
  file should try to do everything.
- Dark-first, VS Code / DevTools visual register. Colours, surfaces, and
  text tones come from the tokens in `src/index.css`; do not introduce new
  colours.
- Every layout works from phone width up; Advanced mode is desktop-only
  (1024 px and wider).
- WCAG 2.1 AA is a requirement: the axe-core audits must stay clean and
  colour contrast is verified in a browser.
- UI primitives follow the shadcn/ui file shape in `src/components/ui/`.
  The shadcn CLI (`pnpm dlx shadcn add …`) needs network access to
  `ui.shadcn.com`; where that is blocked, hand-author the primitive in the
  same shape (cva + `cn()` from `src/shared/lib/utils.ts`).

## TypeScript

- Strict mode, no `any`, `noUncheckedIndexedAccess`.
- **`exactOptionalPropertyTypes`** is on: `prop?: T` does not accept
  `undefined`. Build optional properties with conditional spreads:

  ```ts
  return { ...(edition !== undefined ? { scormEdition: edition } : {}) }
  ```

- **`erasableSyntaxOnly`** is on: no parameter properties
  (`constructor(private readonly x: X)`) and no enums. Declare fields and
  assign them in the constructor.
- `verbatimModuleSyntax`: import types with `import type`.

## Manifest parsing (fast-xml-parser)

- `parseTagValue: false` — otherwise `<schemaversion>1.2</schemaversion>`
  becomes the number `1.2`.
- `parseAttributeValue: false` — identifiers can look numeric.
- `isArray` registers `organization`, `item`, `resource`, `file`, and
  `dependency`, so code never branches on object-vs-array.
- Element and attribute lookups go through `xmlNode.ts`, which matches the
  case-insensitive local name: manifests bind `adlcp`, `imsss`, `adlseq`,
  and `adlnav` to arbitrary prefixes and disagree on `scormType` casing.

## Testing

- **Unit tests** live next to the code (`*.test.ts` under `src/**/tests/`
  or beside the module) and run in jsdom. Runtime tests exercise the real
  scorm-again build — never mock the runtime.
- **Accessibility**: `src/app/a11y.test.tsx` audits both modes with
  axe-core. jsdom cannot compute colours; verify contrast changes in a real
  browser.
- **End to end**: `e2e/*.spec.ts` drive the real app with the committed
  packages in `e2e/fixtures/` (generated by `scripts/make-fixtures.mjs`).
  Add a fixture whenever a feature depends on package content.

## Definition of done

A change is done when, in this order:

```bash
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run build
pnpm run test
pnpm run test:e2e
```

all pass, the change has tests, and the affected documents in `docs/` are
updated in the same change. Debatable architectural choices get a
[decision record](adr/README.md).

## Brand

The SCORMite mark is an open SCORM package with its lid lifted and the
_mite_ — a tiny cube, the defect SCORMite exists to find — inside. It is
generated by `scripts/brand/mark.mjs` on a true pixel-art isometric grid
(2:1 slopes, integer vertices), so it renders pixel-exact at its native
sizes, and uses only the theme's colours.

| Asset                                       | Use                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `public/logo-mark.svg`                      | The mark on dark surfaces (social image, large placements)              |
| `public/logo-mark-24.svg`                   | The mark drawn natively at 24 px (app header)                           |
| `public/logo.svg`                           | The mark on its tile — favicon, README, any light or unknown background |
| `public/icon-*.png`, `apple-touch-icon.png` | App icons (Apple's is full-bleed; iOS rounds it)                        |

Never scale the 32-unit mark to a non-multiple size where crispness
matters; add a geometry drawn for that size instead. The mark is an
original construction; run a trademark search before commercial use.
