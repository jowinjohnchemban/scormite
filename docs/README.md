# SCORMite documentation

SCORMite is a browser-based tester and debugger for SCORM 1.2 and SCORM
2004 e-learning packages. It plays a package the way an LMS does — on the
open-source [scorm-again](https://github.com/jcputney/scorm-again) runtime —
and shows everything the course reports, without uploading it anywhere.

This folder is the project's knowledge hub, written for both people and
AI agents. Every document is kept in sync with the code; where the code and
a document disagree, the document is the bug.

## Using SCORMite

| Document | What it covers |
|---|---|
| [User guide](USER_GUIDE.md) | Testing a package end to end: loading, playing, resume and attempts, reading the API log, validation, reports |
| [SCORM support](SCORM_SUPPORT.md) | Versions and editions, LMS behaviour SCORMite reproduces, sequencing coverage, validation rules, known limitations |

## Building SCORMite

| Document | What it covers |
|---|---|
| [Architecture](ARCHITECTURE.md) | Layers, enforced boundaries, folder structure, the course player, panels, accessibility, tooling |
| [Development](DEVELOPMENT.md) | Setup, conventions, TypeScript and parser gotchas, testing, definition of done |
| [Domain model](DOMAIN_MODEL.md) | Core entities and which feature owns each |
| [Deployment](DEPLOYMENT.md) | Static hosting on Vercel, Cloudflare, or a container; build-time settings |
| [Roadmap](ROADMAP.md) | Milestones delivered, with exit criteria, and what comes next |
| [Architecture decision records](adr/) | Why debatable technical choices were made |
| [Original design](milestones/01-architecture-and-design.md) | The initial design document — a historical snapshot |
