# Contributing to SCORMite

Thanks for helping make SCORM testing less painful. Bug reports, fixes,
documentation, and ideas are all welcome.

## Ground rules

- **SCORMite only shows what is real.** No feature may imply behaviour the
  product does not have — no placeholder panels, no unverified "LMS
  emulation". When the runtime cannot do something faithfully, the UI and
  the docs say so.
- **scorm-again is the runtime, and it is never modified.** SCORMite
  configures and wraps [scorm-again](https://github.com/jcputney/scorm-again);
  runtime fixes belong upstream.
- **Packages never leave the browser.** No uploads, accounts, or telemetry.
- Be respectful: this project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a bug

[Open an issue](https://github.com/jowinjohnchemban/scormite/issues/new/choose)
with the SCORM version, the authoring tool that produced the package, your
browser, and what you expected versus what happened. A report exported from
SCORMite (**Report › Markdown**) usually says it all.

Please do **not** attach SCORM packages you do not have the right to share. If
a problem needs a package to reproduce, a minimal package that shows it is
best.

Security problems are not reported in issues — see the
[security policy](SECURITY.md).

## Making a change

1. Read [docs/development.md](docs/development.md) — the rules the build
   enforces, where code goes, and the definition of done — and
   [docs/architecture.md](docs/architecture.md).
2. Fork the repository and create a branch from `main`.
3. Set up: Node.js 24 and pnpm (the version is pinned in `package.json`):

   ```bash
   pnpm install
   pnpm run dev
   ```

4. Make the change with its tests and documentation. Before opening a pull
   request, run:

   ```bash
   pnpm run lint
   pnpm run format:check
   pnpm run typecheck
   pnpm run test
   pnpm run build
   pnpm run test:e2e
   ```

5. Write commit messages in the
   [Conventional Commits](https://www.conventionalcommits.org) style used in
   the history (`feat(player): …`, `fix(validation): …`, `docs: …`), one
   change per commit.
6. Open a pull request describing what changed and why. CI must pass before
   it is merged.

For a large change — a new panel, a new dependency, a change to the
architecture — open an issue first so the approach can be agreed before you
put in the work.

## Licence

By contributing, you agree that your contributions are licensed under the
[MIT licence](LICENSE) that covers the project.
