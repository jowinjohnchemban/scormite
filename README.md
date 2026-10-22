<p align="center"><img src="public/logo.svg" width="96" height="96" alt="SCORMite logo: an open package with a small cube — the mite — inside"></p>

<h1 align="center">SCORMite</h1>

<p align="center"><strong>Test, debug and validate SCORM packages in your browser.</strong></p>

[![CI](https://github.com/jowinjohnchemban/scormite/actions/workflows/ci.yml/badge.svg)](https://github.com/jowinjohnchemban/scormite/actions/workflows/ci.yml)
![SCORM 1.2](https://img.shields.io/badge/SCORM-1.2-2f6fb0)
![SCORM 2004](https://img.shields.io/badge/SCORM%202004-2nd%20%7C%203rd%20%7C%204th%20Edition-2f6fb0)
[![Runtime: scorm-again 3.4](https://img.shields.io/badge/runtime-scorm--again%203.4-3fb950)](https://github.com/jcputney/scorm-again)
![Sequencing](https://img.shields.io/badge/SCORM%202004-sequencing-3fb950)
![Accessibility: WCAG 2.1 AA](<https://img.shields.io/badge/a11y-WCAG%202.1%20AA%20(axe--core)-3fb950>)
![Privacy: runs locally](https://img.shields.io/badge/privacy-runs%20locally%2C%20no%20upload-7f93ab)

![React 19](https://img.shields.io/badge/React-19-20232a?logo=react)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind%20CSS-4-06b6d4?logo=tailwindcss&logoColor=white)
![pnpm 11](https://img.shields.io/badge/pnpm-11-f69220?logo=pnpm&logoColor=white)
![Tested with Vitest and Playwright](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6e9f18)

Drop a SCORM `.zip` and SCORMite plays it the way an LMS does — on the
open-source [scorm-again](https://github.com/jcputney/scorm-again) runtime —
showing every API call, the live CMI data, validation issues and a
replayable timeline, so you catch tracking problems before uploading to
Moodle, Canvas, SuccessFactors, Cornerstone or any other LMS. Your package
never leaves your browser: no upload, no account, no telemetry.

## Features

- **SCORM 1.2 and SCORM 2004** (2nd, 3rd, 4th Edition); SCORM 1.1 packages run on the 1.2 API
- **Course player** — sandboxed player, course outline for multi-SCO packages, Previous / Next
- **SCORM 2004 sequencing** — the manifest's `imsss` rules run on scorm-again's sequencing engine: disabled items, flow and choice controls, SCO navigation requests, rollup
- **Resume testing** — relaunch a SCO from its saved attempt (`entry=resume`, suspend data, location, score), start a new attempt, or restart the course
- **LMS launch data** — mastery score, launch data, time limits, completion threshold and passing score from the manifest
- **API log** — every call with arguments, result, timing and the runtime's own error explanation
- **CMI inspector, timeline replay and breakpoints** (Advanced mode)
- **Validation** — packaging problems (missing files, broken references, manifest not at the zip root, …) and runtime problems (out-of-range scores, oversized suspend data, missing commits, refused navigation)
- **QA reports** — HTML, Markdown, JSON or CSV

## Quick start

```bash
pnpm install
pnpm run dev        # http://localhost:5173
```

Requires Node.js 24 (the CI version) and pnpm (pinned in `package.json`). See
[Development](docs/development.md) for every command and the definition of
done, and [Deployment](docs/deployment.md) for hosting the static build.

## Architecture

![SCORMite architecture](docs/architecture.svg)

Generated from the code's imports (`pnpm run diagram`); see
[Architecture](docs/architecture.md). The live version, with file and line
counts, is on the site's About page.

## Documentation

All documentation lives in [`docs/`](docs/README.md) — the knowledge hub for
people and agents:

- [User guide](docs/user-guide.md) · [SCORM support](docs/scorm-support.md)
- [Architecture](docs/architecture.md) · [Development](docs/development.md) · [Domain model](docs/domain-model.md)
- [Deployment](docs/deployment.md) · [Roadmap](docs/roadmap.md) · [Decision records](docs/adr/README.md)
