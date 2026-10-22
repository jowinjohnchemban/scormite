# SCORMite documentation

SCORMite is a browser-based tester and debugger for SCORM 1.2 and SCORM
2004 e-learning packages. It plays a package the way an LMS does — on the
open-source [scorm-again](https://github.com/jcputney/scorm-again) runtime —
and shows everything the course reports, without uploading it anywhere.

This folder is the project's knowledge hub, for users, contributors, and AI
coding agents alike. Every document is kept in sync with the code; where the
code and a document disagree, the document is the bug.

## Using SCORMite

| Document                          | What it covers                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [User guide](user-guide.md)       | Testing a package end to end: loading, playing, resume and attempts, reading the API log, validation, reports      |
| [SCORM support](scorm-support.md) | Versions and editions, LMS behaviour SCORMite reproduces, sequencing coverage, validation rules, known limitations |

## Building SCORMite

| Document                          | What it covers                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| [Development](development.md)     | Principles, setup, enforced rules, conventions, testing, definition of done             |
| [Architecture](architecture.md)   | Layers, folder structure, the course player, panels, accessibility, tooling             |
| [Domain model](domain-model.md)   | Core entities and which feature owns each                                               |
| [Deployment](deployment.md)       | Hosting requirements, build settings, generated SEO files, and recipes for common hosts |
| [Roadmap](roadmap.md)             | Milestones delivered, with exit criteria, and what comes next                           |
| [Decision records](adr/README.md) | Why debatable technical choices were made                                               |
| [Archive](archive/)               | Superseded documents kept for their rationale, not maintained                           |

Contributing, the code of conduct, the security policy, and the changelog
are at the repository root: [CONTRIBUTING.md](../CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md), [SECURITY.md](../SECURITY.md),
[CHANGELOG.md](../CHANGELOG.md).

## Writing these documents

- **Names.** Lower-case kebab-case (`scorm-support.md`); each folder's index
  is `README.md`. Decision records are `adr/NNNN-short-title.md`.
- **Shape.** One `#` title, then a short paragraph saying what the document
  covers and who it is for, then `##` sections. Describe the product as it
  is now — history belongs in the [Roadmap](roadmap.md) and in commits, and
  milestone numbers stay out of headings.
- **Links.** Refer to other documents with relative Markdown links
  (`[Architecture](architecture.md#layers)`), and to code with its path from
  the repository root in backticks (`src/app/course/CourseSession.ts`).
- **Same change.** A change that alters behaviour, a rule, or a workflow
  updates the affected documents in the same commit. A new document is
  added to the tables above.
- **Published.** The [User guide](user-guide.md) and
  [SCORM support](scorm-support.md) are also published on the site and in
  `llms.txt`: write them for users, and link only to each other (the build
  fails otherwise). Their opening paragraph is their summary in `llms.txt`.
- **Where else.** Each feature's `src/features/<name>/README.md` says what
  that feature owns. Agent working notes go in `.agent-docs/`, which is
  git-ignored; superseded documents move to `archive/` with a note at the
  top.
