# CLAUDE.md

Instructions for any Claude session (Claude Code, Cowork, or chat with
computer use) working in this repository. Read this before making changes.

## What this project is

SCORM Studio: an offline-first, browser-based developer toolkit for
inspecting, debugging, validating, and testing SCORM packages. It is
explicitly **not** an LMS and **not** an authoring tool — think Chrome
DevTools / VS Code / Postman, but for SCORM packages. SCORM Cloud is the
compatibility benchmark, VS Code is the UX benchmark, Chrome DevTools is
the debugging benchmark. This is intended for eventual commercial release —
treat it as production code, not a prototype.

Full design rationale: `milestones/01-architecture-and-design.md` (original design doc)
and `/docs/` (living reference, kept in sync with the actual code).

## Hard rules — do not violate these

1. **Never modify `scorm-again` source, and never reimplement SCORM runtime
   logic yourself.** All SCORM behavior comes from the `scorm-again`
   package, wrapped by `src/features/runtime`'s adapter + middleware. If
   something feels like it needs a runtime change, it needs a middleware or
   adapter change instead.
2. **Only `src/features/runtime` may import `scorm-again`.** This is
   enforced by ESLint (`no-restricted-imports` in `eslint.config.js`) — a
   violation fails `pnpm run lint`, not just review.
3. **Features may not reach into another feature's internals.** Only
   `app`, `shared`, `components`, and same-feature imports are allowed
   across feature boundaries. Enforced by `eslint-plugin-boundaries` — see
   `docs/adr/0001-eslint-architecture-boundaries.md` for why this needed a
   real import resolver to actually work, not just a config that looks
   right.
4. **Use pnpm, not npm or yarn.** `packageManager` is pinned in
   `package.json`. Don't regenerate a `package-lock.json` or `yarn.lock`.
5. **Never generate large files, placeholder implementations, or mock data
   unless explicitly requested.** Every component needs types; tests and
   docs land in the same milestone as the feature, not "later."
6. **Do the current milestone, not the whole app.** Check `docs/ROADMAP.md`
   for what's next and what "done" means for it. A milestone must build,
   lint, and test clean before the next one starts — don't skip ahead even
   if it seems like less total work.

## Before you touch code

1. Read `docs/ARCHITECTURE.md` for the current state of the layering and
   folder structure.
2. Read `docs/ROADMAP.md` to find the milestone you're working on and its
   exit criteria.
3. If you're adding a new feature folder, follow the pattern in an existing
   `src/features/*/README.md` (ownership description + barrel `index.ts`).
4. If you're making an architecturally debatable choice (a new dependency
   direction, a new "element" type for the boundary rules, a library swap),
   write an ADR in `docs/adr/` using `docs/adr/TEMPLATE.md`. Don't rely on
   a commit message or a Slack thread to carry that reasoning.

## After you touch code

Run, in order, and don't consider the change done until all pass:

```bash
pnpm run lint       # includes architecture boundary checks
pnpm run typecheck
pnpm run test
pnpm run build
```

If you touched anything UI-facing and Playwright specs exist for it
(`e2e/`), run those too. Specs land starting Milestone 3, once there's a
loadable package to test against.

If you added/changed an architectural rule (boundary policy, a new banned
import, a new element type), write a small deliberate-violation test the
way `docs/adr/0001-eslint-architecture-boundaries.md` describes: temporarily
write code that should fail the rule, confirm `pnpm run lint` actually
rejects it, then remove the test file. A rule that "looks right" in config
but doesn't fire on a real violation is worse than no rule, because it
gives false confidence — this happened once already during scaffolding
(the boundaries plugin needed `eslint-import-resolver-typescript` wired up
before it would resolve imports to their owning feature at all).

## Style

- Strict TypeScript, no `any`.
- Feature-first, not layer-first — see `docs/ARCHITECTURE.md`.
- Composition over large components; no file should try to do everything.
- Dark mode first, VS Code/DevTools visual register — see
  `milestones/01-architecture-and-design.md` §5 for wireframes and the
  `frontend-design` skill for aesthetic decisions once real UI (not
  placeholder shells) is being built.
- Accessibility AA is a real requirement, not an aspiration — comes due in
  Milestone 15 but don't introduce violations before then either.

## Known environment quirks

- `shadcn/ui`'s CLI (`pnpm dlx shadcn add ...`) needs network access to
  `ui.shadcn.com`. Some sandboxes (including the one this scaffold was
  built in) don't allow that domain — in that case, hand-author new
  primitives following the existing shape in `src/components/ui/` (cva +
  `cn()` from `src/shared/lib/utils.ts`) rather than blocking on the CLI.
- Playwright browser binaries need `pnpm exec playwright install`, which
  also needs network access this scaffold's sandbox didn't have. Config is
  in place (`playwright.config.ts`); actually running `pnpm run e2e` needs
  an environment with that access.
