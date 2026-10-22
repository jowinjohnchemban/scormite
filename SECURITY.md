# Security policy

## Supported versions

Security fixes go into `main` and are deployed to
<https://scormite.jowinjc.in>. Self-hosted copies should update to the latest
`main`.

## Reporting a vulnerability

Please report vulnerabilities privately — not in a public issue:

- through GitHub's
  [private vulnerability reporting](https://github.com/jowinjohnchemban/scormite/security/advisories/new),
  or
- by email to **scormite@jowinjc.in**.

Include what is affected, how to reproduce it, and the impact you expect. You
will get an acknowledgement within a few days, and a fix or a plan once the
report is confirmed. Credit is given in the release notes unless you prefer
otherwise.

## How SCORMite treats packages

Knowing this helps tell a vulnerability from the design:

- **Packages stay in the browser.** A package is unzipped in memory and its
  files are served from the browser's Cache Storage by a service worker
  under `/scorm-files/`. Nothing is uploaded; there is no server API.
- **A package runs with SCORMite's origin.** SCORM content finds the LMS API
  through `window.parent`, which only works same-origin, so the player's
  iframe is sandboxed with `allow-scripts allow-same-origin`. A package's
  scripts can therefore reach what SCORMite stores in that browser — saved
  progress and layout preferences — just as content reaches the LMS page it
  runs in. **Only open packages you trust,** as you would on an LMS.
- **AI agents (WebMCP).** In browsers with WebMCP, SCORMite offers tools that
  read the open session and navigate or restart it. They act only on the
  session already open in that tab; opening a package is not a tool. Package
  content they return is marked untrusted to the agent, and discarding saved
  data is marked consequential so the browser can ask the user first. A
  package runs with SCORMite's origin, so a malicious one could also register
  tools of its own on the page — one more reason to open only packages you
  trust.
- **Third-party code** is limited to the open-source packages listed on the
  [About page](https://scormite.jowinjc.in/about/) and in `/licenses.txt`;
  dependencies are kept current by Dependabot.

Issues within this model — a way for a package to escape the browser, reach
another origin, or break the service worker's isolation — are exactly what
we want to hear about.
