# User guide

How to test a SCORM package with SCORMite, from opening it to sharing a QA
report. For what is supported and checked, see [SCORM support](scorm-support.md).

## 1. Open a package

Drop a SCORM `.zip` on the page, or click the drop area to browse. Once a
package is open, **Open** in the header (or dropping another zip anywhere)
replaces it, and **Close** returns to the start screen.

Everything runs in your browser — the package is never uploaded. If the
package cannot be opened (not a zip, no `imsmanifest.xml`, nothing
launchable), the reason is shown and any open package keeps running.

**Learner** in the header sets the learner ID and name courses receive —
useful for courses that greet the learner or branch on the ID. Until you set
one, courses get a sample learner (`test-learner`, "Learner, Test"), as an
LMS always supplies one. It applies from the next launch and is remembered in
this browser.

## 2. Play the course

The first item starts immediately. The sidebar (Basic mode) or the
**Outline** panel (Advanced mode) lists the course's items with their
status:

| Icon        | Meaning                  |
| ----------- | ------------------------ |
| Green check | Passed or completed      |
| Red cross   | Failed                   |
| Amber dot   | In progress (incomplete) |
| Grey circle | Not started              |

Choose an item, or use **Previous** / **Next**, to move through the course.
In a SCORM 2004 course the course's own sequencing rules decide what is
allowed: items you cannot choose yet are greyed out ("sequenced" appears
next to the item count), and a refused request is explained in a notice
under the header. When a SCO asks to continue, exit, or end the course, the
player follows it.

When a SCO terminates, a bar over the player offers **Relaunch**,
**New attempt**, and **Next**; when the course itself ends, **Restart
course**.

## 3. Test resume and attempts

**Restart** in the header acts on the current item:

- **Relaunch (resume)** — reload it the way an LMS would. After a
  `suspend` exit its suspend data, location, score, objectives, and
  interactions are restored and `cmi.entry` is `resume`. After any other
  exit, SCORM 2004 starts a new attempt with fresh data; SCORM 1.2
  continues the same attempt with its data (see
  [SCORM support](scorm-support.md#lms-behaviour-scormite-reproduces)).
- **New attempt** — discard its saved data and start it fresh.
- **Restart whole course** — discard all saved data and start from the
  beginning.

Leaving an item and coming back to it also resumes it, as on an LMS.

Progress is also saved in this browser: reopen the same package later — even
after reloading the page — and SCORMite resumes at the item you were on, with
each item's saved data. **Restart whole course** forgets the saved progress.

## 4. Read what the course reports

**Basic mode** shows the running item's status, success, score, location,
and time, and a compact API log. Hover a log row for the full call, its
result, and — for failed calls — the SCORM error and the runtime's
explanation.

**Advanced mode** (screens 1024 px and wider) adds dockable panels, opened
from **Panels** in the toolbar:

| Panel         | Use it to                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outline       | Navigate the course (as in Basic mode)                                                                                                                                                         |
| Manifest      | Browse the organizations, items, and resources of `imsmanifest.xml`; expand an item to see its resource, href, parameters, launch data, and sequencing                                         |
| Files         | Browse the files in the zip; launch files are marked                                                                                                                                           |
| CMI Inspector | See the live data model; changed values are highlighted; filter by path or value                                                                                                               |
| API Log       | See every API call, how often each method was called, and why failed calls failed ("Failed only" filter)                                                                                       |
| CMI History   | Scrub through the current launch and see the data model at any point                                                                                                                           |
| Breakpoints   | Hold a specific `SetValue` or `Commit` before it is applied, inspect the data, then resume. The course keeps running and is told the call succeeded; held calls are applied in order on Resume |
| Validation    | See every packaging and runtime issue — including when the LMS rules recorded a different status than the course reported, and which rule did it                                               |
| Network       | See each file the course requested and which are missing from the package ("Missing only" filter)                                                                                              |

Each panel has a fixed place — course structure on the left, runtime state
on the right, logs and tools as tabs at the bottom. Show or hide panels from
**Panels** (grouped into Course, Runtime, and Problems), close one with its ×,
and drag the dividers to resize; your choices are remembered. **Panels ›
Reset layout** restores the defaults.

## 5. Check for problems

Packaging problems (missing files, broken references, a manifest that is
not at the zip root, …) are found as soon as the package opens. Runtime
problems (out-of-range scores, oversized suspend data, terminating without
a commit, refused navigation) appear while the course runs. Basic mode
counts package errors under the package name; Advanced mode lists every
issue in **Validation**. The [rule list](scorm-support.md#validation-rules)
explains each one.

## 6. Share a report

**Report** in the header downloads the session as an HTML report (to read
or attach), Markdown, JSON (for tooling), or CSV (the API calls, for a
spreadsheet). The HTML, Markdown, and JSON reports contain the package
summary, each item's result, the runtime summary, all validation issues,
every API call with error explanations, and the current item's data
changes; the HTML report prints cleanly.

## 7. Work with an AI agent

SCORMite offers its session to AI agents in your browser through
[WebMCP](https://webmachinelearning.github.io/webmcp/), so you can ask an
agent things like "why does the quiz report failed?" or "relaunch this lesson
and check it resumes". The agent works on the same session you see — the
package you opened, in your browser — and nothing is uploaded by SCORMite.

| Tool                      | What the agent can do                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `get_session`             | See the package, its items with their status and score, the running item, and what navigation is allowed             |
| `get_cmi`                 | Read the running item's data model (optionally one branch, e.g. `cmi.objectives`)                                    |
| `get_api_log`             | Read the API calls, with error explanations (optionally failed calls only)                                           |
| `get_validation_issues`   | List packaging and runtime problems                                                                                  |
| `get_report`              | Get the QA report as Markdown or JSON                                                                                |
| `launch_item`, `navigate` | Launch an item, or go to the next / previous one — within the course's sequencing rules                              |
| `relaunch_item`           | Relaunch the running item from its saved data, to test resume                                                        |
| `discard_and_restart`     | Start a new attempt of the item, or restart the course — this discards saved data, so your browser may ask you first |
| `set_view_mode`           | Switch between Basic and Advanced mode                                                                               |

Opening a package stays with you: drop the zip yourself, then ask the agent.
Package content — titles, data-model values, API arguments — is marked to
agents as untrusted, because a package could contain text written to steer
an agent.

**Where it works.** WebMCP is new. It runs in browsers and assistants that
support it — Chrome and Edge through their WebMCP trials (or Chrome's
`chrome://flags/#enable-webmcp-testing` flag), ChatGPT Desktop, and Brave's
Leo — and SCORMite does nothing extra in browsers that do not.
