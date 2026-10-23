# AI agents

How to let an AI agent test a SCORM package in SCORMite with you: how to connect
one, what it can do, the requests that get the most out of it, how your data is
treated, and answers to common questions. It works through
[WebMCP](https://webmachinelearning.github.io/webmcp/), a proposed web standard
that lets a web page offer tools to an agent in the same browser.

## What an agent can do

Once a package is open, an agent working in your browser can do anything you can
do in SCORMite, and more: review every page's content and wording, take the
course like a learner, check the logic and what it reports, scan the package
for anything unsafe, and write up the findings — on the same session you see,
with nothing uploaded by SCORMite.

| Area                  | Tools                                                                                               | What they do                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan and audit        | `get_test_plan`, `audit_session`                                                                    | A step-by-step QA plan for this package; one check of everything so far, with next steps                                                           |
| Session               | `get_session`, `launch_item`, `navigate`, `relaunch_item`, `discard_and_restart`, `set_view_mode`   | See the items and their status; move through the course within its sequencing rules; test resume; start over; switch Basic / Advanced              |
| Package               | `open_package_from_url`, `close_package`, `get_manifest`, `list_files`, `read_file`                 | Open a package from a link, or close it; review the manifest, the file list, and any file's text                                                   |
| Content review        | `extract_course_text`, `search_package`, `check_references`, `read_sco_page`                        | All the course's text (pages, captions, titles, image alt text) for grammar, spelling, and wording; search every file; broken and external links   |
| Take the course       | `interact_with_sco`, `wait_for`, `run_script_in_sco`                                                | Click, type, select, or check like a learner; wait for the page or the data to change; run a script in the course for anything else                |
| Tracking and logic    | `get_cmi`, `get_cmi_changes`, `get_assessment_data`, `call_scorm_api`, `get_api_log`, `get_network` | The data model and how it changed; every question, answer, and objective; call the SCORM API directly; every API call explained; every file loaded |
| Security              | `scan_package_security`, `get_file_hashes`                                                          | A scan for programs, miners, hidden code, and credential forms; SHA-256 hashes to check files with an antivirus engine                             |
| Findings and evidence | `add_review_finding`, `clear_review_findings`, `get_validation_issues`, `get_report`                | Record what the review found so it shows in the Validation panel and the report; packaging and runtime issues; the QA report as Markdown or JSON   |
| Debugging             | `manage_breakpoints`, `set_learner`                                                                 | Hold API calls to inspect them; change the learner the course sees                                                                                 |

## Connect an agent

WebMCP is new, so it depends on the browser and the agent.

**Chrome (testing).**

1. Use Chrome 149 or later (`chrome://version`).
2. Open `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and
   relaunch Chrome.
3. Install Google's
   [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
   extension and give it a Gemini API key (free from
   [Google AI Studio](https://aistudio.google.com)).
4. Open SCORMite, drop a package, then open the extension and ask in plain
   language.

To see the tools without an AI model, open DevTools → **Application → WebMCP**.

**Other agents.** ChatGPT Desktop and Brave's Leo assistant are listed as WebMCP
clients by the
[WebMCP project](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md).
Agents without WebMCP can still use SCORMite by reading and clicking the page,
like a person — slower and less precise than the tools.

**For everyone, without the flag.** Chrome 149 and Edge 150 run WebMCP as an
origin trial. A site owner registers the site's origin for the trial and adds
the token to the deployment; then visitors' agents can use the tools without
any flag.

## A complete QA run

Open a package, then ask the agent something like:

> Test this SCORM package completely. Start with get_test_plan and follow it:
> scan it for security problems, review all the text for grammar, spelling,
> and consistency, take every item to the end, test resume and the failing
> path, check the quiz answers are recorded correctly, and record every problem
> with add_review_finding. Then run audit_session and give me the findings with
> the report.

The agent then:

1. reads the plan for the package (`get_test_plan`) and its structure
   (`get_manifest`, `list_files`), and scans it (`scan_package_security`);
2. reviews the content without launching anything (`extract_course_text`,
   `search_package`, `check_references`);
3. for each item, launches it, reads the page (`read_sco_page`), works through
   it (`interact_with_sco`, `wait_for`), and checks what it reports (`get_cmi`,
   `get_assessment_data`, `get_api_log`);
4. tests resume (`relaunch_item`) and the failing path (`discard_and_restart`);
5. records what it found (`add_review_finding`) and collects everything
   (`audit_session`, `get_report`).

Its findings appear in the **Validation** panel as **review** issues, next to
SCORMite's own packaging and runtime checks, and in the exported report.

## Things to ask

Anything you would check by hand, an agent can check with the tools. For
example:

**Content and language**

- "Proofread every page and caption. Record each grammar and spelling mistake
  with the page it is on and the correction."
- "Is the terminology consistent? We say 'learner', never 'student' or 'user'."
- "Rewrite the instructions on the first page in plain English."
- "Does every image have meaningful alt text? Is anything in the wrong
  language?"
- "Translate the quiz questions into French so I can check the meaning."

**Logic and assessment**

- "Answer every question correctly and confirm the course reports passed; then
  answer wrongly and confirm it reports failed."
- "Do the correct answers in the quiz match the correct responses the course
  reports?"
- "Does the score respect the mastery score in the manifest?"
- "Set the score to 79 through the API and check what the course shows."

**Tracking and troubleshooting**

- "Why does this course report failed?"
- "Which API calls failed, and what do the errors mean?"
- "Does suspend data restore the learner's place after a relaunch?"
- "Pause the course before it sets the score, and show me the data."

**Packaging and safety**

- "Are any files the course needs missing from the package?"
- "Which external sites does this course depend on?"
- "Is this package safe to upload to our LMS?"

## Safety and privacy

- **Nothing is uploaded by SCORMite.** The package stays in your browser. The
  agent you use decides what it sends to its own service — the same as when it
  reads any other page.
- **Package content is marked untrusted.** Titles, page text, file contents,
  and tracking values come from the package, which could contain text written
  to steer an agent. Tools that return them say so to the agent.
- **Consequential tools ask first.** Discarding saved progress
  (`discard_and_restart`), running a script in the course
  (`run_script_in_sco`), and opening or closing a package
  (`open_package_from_url`, `close_package`) are marked consequential, so your
  browser can ask you before they run.
- **Scripts run with the course's own access.** `run_script_in_sco` runs in the
  course's page, which can already run any script it contains; it gives the
  agent no more access than the package has.
- **Only open packages you trust.** A package runs with SCORMite's origin (the
  SCORM API requires it), so a malicious one could reach the page — including
  WebMCP. Scan unfamiliar packages first (`scan_package_security`).

## FAQ

**Do I need to sign in or pay for anything in SCORMite?**
No. SCORMite has no accounts. You need an agent that supports WebMCP; it may
need its own account or API key.

**Can SCORMite use my ChatGPT or Claude session from another tab?**
No. Browsers keep each site's sign-in separate, and SCORMite never handles your
credentials. Instead, use the agent service's own browser app or extension on
the SCORMite tab — it uses your existing account.

**Can an agent check grammar and spelling?**
Yes. SCORMite gives the agent the text; the agent's own model reviews it.
`extract_course_text` returns the text of every page and caption file and the
manifest's titles at once, and `read_sco_page` the text of the running page,
including text the course builds with scripts. Ask the agent to record each
mistake with `add_review_finding` so you get a list in the Validation panel and
the report.

**Where do the agent's findings go?**
`add_review_finding` adds each one to the **Validation** panel as a **review**
issue (error, warning, or suggestion, with its category and location), and to
the QA report. `clear_review_findings` removes them; SCORMite's own checks stay.

**Can an agent open a package for me?**
Yes, from a link: `open_package_from_url` downloads a .zip and opens it,
replacing the open package (your browser can ask you first). The server must
allow cross-origin downloads; if it does not, download the file and drop it on
the page.

**Can an agent take a quiz?**
Yes. `read_sco_page` lists the page's controls with refs, and
`interact_with_sco` clicks, types, selects, or checks them, so the agent can
work through lessons and quizzes. For anything else — drag and drop, a canvas,
a video to skip, or the course's own variables — it can use
`run_script_in_sco`. `get_assessment_data` then shows each question, the
learner's answer, the correct answer, and the result.

**Can an agent set tracking data directly?**
Yes. `call_scorm_api` calls the SCORM API as the course does — for example to
set a score, a status, or suspend data, or to see which error an invalid value
returns. The calls appear in the API log like the course's own.

**Does SCORMite scan packages for malware?**
`scan_package_security` checks every file against open rules for what a SCORM
package should never contain: programs and installers (also when renamed to look
like images or scripts), Office documents with macros, browser crypto-miners,
code hidden by encoding or packing, ActiveX scripting, hidden frames that load
other sites, password fields and forms that send data elsewhere, redirects and
breaking out of the LMS window, and service workers. It runs in your browser,
offline. It is not an antivirus engine: for a malware verdict, get the files'
SHA-256 hashes with `get_file_hashes` and check them with one (such as ClamAV),
or a malware database such as VirusTotal.

**Does the agent see my course content?**
Yes — reading pages and files is how it reviews them. Whatever your agent does
with that content is governed by that agent's service.

**Why did a tool return an error?**
Tools check the session when they run and explain what to do instead — for
example to launch an item first, that the sequencing rules forbid a choice, or
that a launch is still in progress. The agent can follow the message and retry.

**Will it work in Firefox or Safari?**
Not yet; neither has shipped WebMCP. SCORMite works there as usual, without the
tools.

**Can the agent change my package?**
No. It can read files and run the course, but nothing it does changes the zip.
It can change the session: launch, restart, set data through the API, set
breakpoints, set the learner, or record findings. To fix the course, ask it
what to change and where — `search_package` finds every place a string appears.

**Where are the results?**
Ask for `get_report` — the same QA report as the **Report** menu — or for
`audit_session`'s findings. See the [User guide](user-guide.md) for what the
report contains and [SCORM support](scorm-support.md) for the rules it checks.
