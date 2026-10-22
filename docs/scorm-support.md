# SCORM support

What SCORMite supports, what it reproduces of an LMS, what it checks, and
where its limits are. Every runtime behaviour comes from
[scorm-again](https://github.com/jcputney/scorm-again) 3.4.6, which SCORMite
configures and wraps but never modifies.

## Standards

| Standard | Support |
|---|---|
| SCORM 1.2 | Full runtime (`window.API`, `LMS*` calls) |
| SCORM 1.1 | Runs on the SCORM 1.2 API, as on production LMSs |
| SCORM 2004 2nd Edition (`CAM 1.3`) | Full runtime (`window.API_1484_11`) and sequencing |
| SCORM 2004 3rd Edition | Full runtime and sequencing |
| SCORM 2004 4th Edition | Full runtime and sequencing |
| AICC, xAPI (Tin Can), cmi5 | Not supported |

The version and edition come from `<schemaversion>`; when it is missing,
from the manifest's namespaces.

## Packages

- A `.zip` with `imsmanifest.xml` at its root.
- A zip of the course **folder** (manifest one level down) is opened anyway
  and reported as a `package.manifest-not-at-root` error, because LMSs
  reject it.
- macOS `__MACOSX/` and `.DS_Store` entries are ignored.
- Manifest parsing is namespace-prefix and case agnostic (`adlcp:scormType`
  vs `adlcp:scormtype`, custom prefixes).
- `xml:base` on `<manifest>`, `<resources>`, and `<resource>` is applied to
  launch paths and file lists.
- Item `parameters` are appended to the launch URL following the Content
  Aggregation Model rules (query strings joined with `&`, fragments kept).
- The default organization is played; when none is declared, the first.
- Files are served from the browser's Cache Storage by a service worker,
  with correct content types for HTML, JavaScript modules, CSS, media,
  fonts, captions, PDF, and WebAssembly.

## LMS behaviour SCORMite reproduces

**Launch data.** Before a SCO initializes, the item's manifest data is
loaded into the runtime:

| Manifest | SCORM 1.2 element | SCORM 2004 element |
|---|---|---|
| `adlcp:datafromlms` / `adlcp:dataFromLMS` | `cmi.launch_data` | `cmi.launch_data` |
| `adlcp:masteryscore` | `cmi.student_data.mastery_score` | — |
| `adlcp:maxtimeallowed` | `cmi.student_data.max_time_allowed` | — |
| `adlcp:timelimitaction` | `cmi.student_data.time_limit_action` | `cmi.time_limit_action` |
| `adlcp:completionThreshold` | — | `cmi.completion_threshold` |
| primary objective `minNormalizedMeasure` (when `satisfiedByMeasure`) | — | `cmi.scaled_passing_score` |
| (always) | `cmi.core.credit = credit` | `cmi.credit = credit` (runtime default) |

**Status rules** (fixed, modelled on SCORM Cloud): at Finish a mastery
score decides passed / failed when the SCO reported a score; a status the
SCO set itself is respected; an unset status stays incomplete.

**Attempts and resume.** A new attempt starts with `entry` = `ab-initio`.
When a SCO is left, its data is stored exactly as scorm-again would commit
it at Terminate (including accumulated `total_time`). What a relaunch
starts from follows each version's rules:

| Previous exit | SCORM 1.2 | SCORM 2004 |
|---|---|---|
| `suspend` | Same attempt, data restored, `entry` = `resume` | Same attempt, data restored, `entry` = `resume` |
| anything else | Same attempt (1.2 has no attempt boundary), data restored, `entry` blank | New attempt, fresh data, `entry` = `ab-initio` |

*New attempt* discards one SCO's data; *Restart whole course* discards all
of it.

**Saved progress.** Like an LMS keeping a learner record, SCORMite saves
each SCO's attempt, per-item progress, the current item, and — for SCORM
2004 — the sequencing engine's state in this browser (IndexedDB) on every
Commit, Terminate, and SCO change. Reopening the same package (same
manifest and zip size) resumes where you were, with a notice; *Restart
whole course* forgets it. Nothing is uploaded, and private browsing modes
that block IndexedDB simply start fresh each time.

**Breakpoints** hold `SetValue` / `Commit` calls (the SCO is answered
`true` immediately; the SCORM API cannot wait). Held calls are applied in
order on Resume — or discarded, unapplied, if you navigate to another SCO
first, so one SCO's data never lands in the next one's runtime.

**Learner.** Set a learner ID and name from **Learner** in the header; they
are reported as `cmi.core.student_id` / `cmi.core.student_name` (1.2) or
`cmi.learner_id` / `cmi.learner_name` (2004) from the next launch, and win
over values in a restored attempt. Until set they are `test-learner` and
"Learner, Test" (the "Last, First" form), and they are remembered in this
browser.

## Navigation and sequencing

**SCORM 1.2** courses play in manifest order: the outline and Previous /
Next launch any item.

**SCORM 2004** courses run on scorm-again's SCORM 2004 sequencing engine,
configured from the manifest's IMS Simple Sequencing:

| Supported | Notes |
|---|---|
| `controlMode` (choice, choiceExit, flow, forwardOnly, useCurrentAttempt…) | |
| Pre-, exit-, and post-condition rules | All IMS conditions, `not`, `all` / `any`, `measureThreshold` |
| `limitConditions` | `attemptLimit`, `attemptAbsoluteDurationLimit` |
| Rollup rules and rollup controls | Single-condition rules, and multi-condition rules combined with `all` |
| `adlseq:rollupConsiderations`, `constrainedChoiceConsiderations` | |
| Objectives, global objectives (`mapInfo`, extended `adlseq:mapInfo`) | |
| `randomizationControls`, `deliveryControls` | |
| `imsss:sequencingCollection` (`IDRef`) | Controls, rules, and rollup |
| `adlnav:hideLMSUI` | Hides the player's Previous / Next |
| SCO navigation requests | `continue`, `previous`, `choice`, `jump`, `exit`, `exitAll`, `suspendAll`, `abandon`, `abandonAll` |

The outline disables items the rules do not currently allow (using the
engine's look-ahead), Previous / Next follow the engine, and item statuses
show the engine's rolled-up view.

Declared sequencing the engine cannot evaluate faithfully is **not**
approximated; it is left out and reported as a `sequencing.unsupported`
warning:

- rollup conditions with `operator="not"`;
- rollup rules combining several conditions with `any` (the IMS default);
- rollup conditions `attemptLimitExceeded`, `timeLimitExceeded`,
  `outsideAvailableTimeRange`;
- rule actions placed in the wrong rule type;
- objectives and limit conditions inside a shared sequencing collection.

If the engine cannot start a course at all, it is played in manifest order
and a `sequencing.start-failed` warning is reported.

## Validation rules

| Rule | Severity | When it fires |
|---|---|---|
| `package.manifest-not-at-root` | error | The manifest is inside a folder of the zip |
| `manifest.missing-launch-file` | error | A resource's launch file is not in the package |
| `manifest.missing-resource-file` | error | A file a resource declares is not in the package |
| `manifest.broken-item-reference` | error | An item references a resource that does not exist |
| `manifest.duplicate-identifier` | warning | Two resources share an identifier |
| `manifest.no-sco-resource` | warning | The package has no SCO resource |
| `sequencing.unsupported` | warning | Declared sequencing the runtime will not evaluate (see above) |
| `sequencing.start-failed` | warning | The sequencing engine could not start the course |
| `runtime.score-out-of-range` | error | SCORM 1.2 score outside 0–100 or not a number |
| `runtime.suspend-data-oversized` | warning | `suspend_data` longer than 4096 (1.2), 4000 (2004 2nd / 3rd), or 64000 (2004 4th) characters |
| `runtime.missing-commit` | warning | Terminate without a successful Commit in that session |
| `runtime.status-overridden` | warning | The status recorded at Terminate differs from the one the SCO set, with the rule that decided it (1.2 mastery score; 2004 passing score or completion threshold) |
| `sequencing.request-refused` | warning | The course requested navigation its rules do not allow |

Every failed API call is also shown in the API log with its SCORM error
code and scorm-again's explanation (`GetErrorString` / `GetDiagnostic`).

## Known limitations

- **External launch URLs.** Resources whose `href` is an absolute URL on
  another site cannot reach the SCORM API from SCORMite's player and are not
  supported.
