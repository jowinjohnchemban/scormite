# Changelog

All notable changes to SCORMite are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-22

First public release, under the MIT licence.

### Added

- **Packages:** SCORM 1.2 and SCORM 2004 2nd, 3rd, and 4th Edition, with SCORM
  1.1 on the 1.2 API. Opened in the browser and never uploaded; folder-wrapped
  zips are re-rooted and reported.
- **Course player:** multi-SCO outline, Previous / Next, and SCO navigation
  requests. SCORM 2004 sequencing runs on scorm-again's engine from the
  manifest's `imsss` rules.
- **LMS behaviour:**
  - manifest launch data (mastery score, launch data, time limits, completion
    threshold, passing score) and a sample learner;
  - resume and new attempts;
  - saved progress across reloads.
- **Basic mode:** live status and a compact API log.
- **Advanced mode:** dockable panels — Outline, Manifest, Files, CMI
  Inspector, API Log, CMI History, Breakpoints, Validation, Network.
- **Validation:**
  - packaging rules (missing files, broken references, manifest not at the
    zip root, …);
  - runtime rules (out-of-range score, oversized suspend data, missing
    commit, refused navigation, and a status the LMS rules changed on exit).
- **Reports:** HTML, Markdown, JSON, and CSV QA reports.
- **About page:** developer credit, build details, a live architecture
  diagram, and the open-source licences of everything shipped.
- **Search engines and AI assistants:** robots.txt, sitemap.xml, llms.txt,
  and llms-full.txt are generated per build. Preview deployments are kept
  out of search engines.
- **Accessibility:** WCAG 2.1 AA, audited with axe-core in unit and browser
  tests.

[1.0.0]: https://github.com/jowinjohnchemban/scormite/releases/tag/v1.0.0
