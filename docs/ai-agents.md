# AI agents

How to let an AI agent test a SCORM package in SCORMite with you: how to connect
one, what it can do, a complete QA run you can ask for, how your data is
treated, and answers to common questions. It works through
[WebMCP](https://webmachinelearning.github.io/webmcp/), a proposed web standard
that lets a web page offer tools to an agent in the same browser.

## What an agent can do

Once you have opened a package, an agent working in your browser can review it,
take the course like a learner, check what it reports, and write up the
findings — on the same session you see, with nothing uploaded by SCORMite.

| Area                  | Tools                                                                                             | What they do                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Plan and audit        | `get_test_plan`, `audit_session`                                                                  | A step-by-step QA plan for this package; one check of everything so far, with next steps                                                 |
| Session               | `get_session`, `launch_item`, `navigate`, `relaunch_item`, `discard_and_restart`, `set_view_mode` | See the items and their status; move through the course within its sequencing rules; test resume; start over; switch Basic / Advanced    |
| Content               | `get_manifest`, `list_files`, `read_file`, `read_sco_page`                                        | Review the manifest, the package's files and their text, and the page the learner sees (text, headings, images, controls, accessibility) |
| Take the course       | `interact_with_sco`                                                                               | Click, type, select, or check on the running page, like a learner                                                                        |
| Tracking              | `get_cmi`, `get_cmi_changes`, `get_api_log`, `get_network`                                        | The data model now and how it changed; every API call with error explanations; every file the course requested                           |
| Problems and evidence | `get_validation_issues`, `get_report`                                                             | Packaging and runtime issues; the QA report as Markdown or JSON                                                                          |
| Debugging             | `manage_breakpoints`, `set_learner`                                                               | Hold API calls to inspect them; change the learner the course sees                                                                       |

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
> take every item to the end, test resume and the failing path, review each
> page's content and accessibility, then run audit_session and give me the
> findings with the report.

The agent then:

1. reads the plan for the package (`get_test_plan`) and its structure
   (`get_manifest`, `list_files`);
2. for each item, launches it, reads the page (`read_sco_page`), works through
   it (`interact_with_sco`), and checks what it reports (`get_cmi`,
   `get_api_log`);
3. tests resume (`relaunch_item`) and the failing path (`discard_and_restart`);
4. collects everything (`audit_session`, `get_report`).

Shorter requests work too:

- "Why does this course report failed?"
- "Which API calls failed, and what do the errors mean?"
- "Check the text of every page for spelling and consistency."
- "Are any files the course needs missing from the package?"
- "Pause the course before it sets the score, and show me the data."

## Safety and privacy

- **Nothing is uploaded by SCORMite.** The package stays in your browser. The
  agent you use decides what it sends to its own service — the same as when it
  reads any other page.
- **Opening a package is yours.** No tool opens or downloads packages; you
  choose what runs.
- **Package content is marked untrusted.** Titles, page text, file contents,
  and tracking values come from the package, which could contain text written
  to steer an agent. Tools that return them say so to the agent.
- **Discarding data asks first.** `discard_and_restart` deletes saved progress,
  so it is marked consequential and your browser can ask you before it runs.
- **Only open packages you trust.** A package runs with SCORMite's origin (the
  SCORM API requires it), so a malicious one could reach the page — including
  WebMCP.

## FAQ

**Do I need to sign in or pay for anything in SCORMite?**
No. SCORMite has no accounts. You need an agent that supports WebMCP; it may
need its own account or API key.

**Can SCORMite use my ChatGPT or Claude session from another tab?**
No. Browsers keep each site's sign-in separate, and SCORMite never handles your
credentials. Instead, use the agent service's own browser app or extension on
the SCORMite tab — it uses your existing account.

**Can an agent open a package for me?**
No, by design. Drop the zip yourself; the agent works on what you opened.

**Does the agent see my course content?**
Yes — reading pages and files is how it reviews them. Whatever your agent does
with that content is governed by that agent's service.

**Can an agent take a quiz?**
Yes. `read_sco_page` lists the page's controls with refs, and
`interact_with_sco` clicks, types, selects, or checks them, so the agent can
work through lessons and quizzes. Content drawn on a canvas, or inside a nested
frame, cannot be operated this way.

**Why did a tool return an error?**
Tools check the session when they run and explain what to do instead — for
example to launch an item first, that the sequencing rules forbid a choice, or
that a launch is still in progress. The agent can follow the message and retry.

**Will it work in Firefox or Safari?**
Not yet; neither has shipped WebMCP. SCORMite works there as usual, without the
tools.

**Can the agent change my package?**
No. It can read files and run the course, but nothing it does changes the zip.
It can change the session: launch, restart, set breakpoints, or set the learner.

**Where are the results?**
Ask for `get_report` — the same QA report as the **Report** menu — or for
`audit_session`'s findings. See the [User guide](user-guide.md) for what the
report contains and [SCORM support](scorm-support.md) for the rules it checks.
