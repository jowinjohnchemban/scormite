# User guide

How to test a SCORM package with SCORMite, from opening it to sharing a QA
report. For what is supported and checked, see [SCORM support](SCORM_SUPPORT.md).

## 1. Open a package

Drop a SCORM `.zip` on the page, or click the drop area to browse. Once a
package is open, **Open** in the header (or dropping another zip anywhere)
replaces it, and **Close** returns to the start screen.

Everything runs in your browser — the package is never uploaded. If the
package cannot be opened (not a zip, no `imsmanifest.xml`, nothing
launchable), the reason is shown and any open package keeps running.

## 2. Play the course

The first item starts immediately. The sidebar (Basic mode) or the
**Outline** panel (Advanced mode) lists the course's items with their
status:

| Icon | Meaning |
|---|---|
| Green check | Passed or completed |
| Red cross | Failed |
| Amber dot | In progress (incomplete) |
| Grey circle | Not started |

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

- **Relaunch (resume)** — reload it with its saved data. `cmi.entry` is
  `resume` if the SCO exited with `suspend`; its suspend data, location,
  score, objectives, and interactions are restored.
- **New attempt** — discard its saved data and start it fresh.
- **Restart whole course** — discard all saved data and start from the
  beginning.

Leaving an item and coming back to it also resumes it, as on an LMS.

## 4. Read what the course reports

**Basic mode** shows the running item's status, success, score, location,
and time, and a compact API log. Hover a log row for the full call, its
result, and — for failed calls — the SCORM error and the runtime's
explanation.

**Advanced mode** (screens 1024 px and wider) adds dockable panels, opened
from **Panels** in the toolbar:

| Panel | Use it to |
|---|---|
| Outline | Navigate the course (as in Basic mode) |
| Manifest | Browse the organizations, items, and resources of `imsmanifest.xml`; expand an item to see its resource, href, parameters, launch data, and sequencing |
| Package | Browse the files in the zip; launch files are marked |
| CMI Inspector | See the live data model; changed values are highlighted; filter by path or value |
| API Monitor | See every API call, how often each method was called, and why failed calls failed ("Failed only" filter) |
| Timeline | Scrub through the run and see the data model at any point |
| Breakpoints | Hold a specific `SetValue` or `Commit` before it is applied, inspect the data, then resume. The course keeps running and is told the call succeeded; held calls are applied in order on Resume |
| Validation | See every packaging and runtime issue |
| Network | See each file the course requested and which are missing from the package ("Missing only" filter) |

Panels can be dragged between the left, right, and bottom docks, resized,
and closed; the layout is remembered. **Panels › Reset layout** restores
the default.

## 5. Check for problems

Packaging problems (missing files, broken references, a manifest that is
not at the zip root, …) are found as soon as the package opens. Runtime
problems (out-of-range scores, oversized suspend data, terminating without
a commit, refused navigation) appear while the course runs. Basic mode
counts package errors under the package name; Advanced mode lists every
issue in **Validation**. The [rule list](SCORM_SUPPORT.md#validation-rules)
explains each one.

## 6. Share a report

**Report** in the header downloads the session as an HTML report (to read
or attach), Markdown, JSON (for tooling), or CSV (the API calls, for a
spreadsheet). The HTML, Markdown, and JSON reports contain the package
summary, each item's result, the runtime summary, all validation issues,
every API call with error explanations, and the current item's data
changes; the HTML report prints cleanly.
