# llms.txt — Complete Notes

## 1. What is llms.txt?
`llms.txt` is a proposed convention for websites to provide AI/LLM systems with a concise, structured, machine-friendly guide to the website's most important content.

It is similar in concept to `robots.txt` and `sitemap.xml`, but its purpose is different:

- `robots.txt` → controls crawler access.
- `sitemap.xml` → lists URLs that exist on a website.
- `llms.txt` → explains what the website is about and points AI systems to important resources.
- `llms-full.txt` → can provide a much more complete, LLM-friendly representation of documentation/content.
The proposal is documented at [https://llmstxt.org/](https://llmstxt.org/).

Important: `llms.txt` is **not an official web standard** and does not guarantee that ChatGPT, Claude, Gemini, Perplexity, or other AI systems will read or use it.

---

## 2. Why was llms.txt proposed?
Modern websites are usually designed for humans and browsers and may contain:

- HTML/CSS/JavaScript
- Navigation
- Ads
- Cookie banners
- Sidebars
- Tracking scripts
- Images
- Footer content
- Login interfaces
- Dynamic content
An AI system trying to understand a website may have to process many pages to determine:

- What the website does
- What its important features are
- Which documentation is authoritative
- Where the API reference is
- Which pages are useful
- Which resources should be prioritized
`llms.txt` provides a curated map of this information.

Instead of an AI having to discover everything itself:

```
Website
 ├── Home
 ├── About
 ├── Products
 ├── Blog
 ├── Documentation
 ├── Pricing
 ├── Login
 ├── Privacy
 └── 500 other pages
```
the site can provide:

```
llms.txt

Project description
        ↓
Important resources
        ↓
Documentation
        ↓
API
        ↓
Guides
        ↓
Other authoritative pages
```

---

# 3. Where should llms.txt be located?
The normal convention is:

```
https://example.com/llms.txt
```
For example:

```
https://pdflare.jowinjc.in/llms.txt
```
It should normally be placed at the root of the website.

For a Next.js project:

```
public/
└── llms.txt
```
For Vite:

```
public/
└── llms.txt
```
For a traditional static website:

```
public_html/
├── index.html
├── robots.txt
├── sitemap.xml
└── llms.txt
```
The web server should serve it as a normal text/Markdown resource.

---

# 4. Basic llms.txt structure
The proposed format is based on Markdown.

Basic structure:

```
# Project Name

> Short description of the project.

Optional longer description explaining the project.

## Documentation

- [Getting Started](https://example.com/docs/getting-started):
  Installation and first-use instructions.

- [API Reference](https://example.com/docs/api):
  Complete API documentation.

## Guides

- [Guide 1](https://example.com/guides/guide-1):
  Description of the guide.

## Resources

- [GitHub](https://github.com/example/project):
  Source code and project information.
```

---

# 5. Important parts

## H1 title

```
# pdflare
```
Identifies the website/project.

## Blockquote summary

```
> A privacy-focused browser-based PDF toolkit.
```
Provides the most important short description.

It should answer:

> "What is this website/project?"

## H2 sections
Examples:

```
## Documentation

## Guides

## API

## Features

## Resources

## Legal
```
These organize the site's important resources.

---

# 6. Descriptions are important
Avoid only listing URLs:

```
## Documentation

- https://example.com/docs
- https://example.com/api
- https://example.com/tutorial
```
Prefer:

```
## Documentation

- [Getting Started](https://example.com/docs/getting-started):
  Installation and first-use instructions.

- [API Reference](https://example.com/docs/api):
  Complete REST API documentation.

- [Authentication](https://example.com/docs/authentication):
  API key and OAuth authentication instructions.
```
This gives an AI context about why each URL is important.

---

# 7. Example: SaaS application
Suppose a SaaS product called `Invitly` provides online event invitations.

Its `llms.txt` could be:

```
# Invitly

> Online event invitation platform for creating, managing, and
> sharing digital invitations.

Invitly helps users create digital invitations for events,
manage guest information, and share invitation links.

## Product

- [Homepage](https://invitly.example/):
  Overview of Invitly.

- [Features](https://invitly.example/features):
  Invitation, guest management, RSVP, and event features.

- [Pricing](https://invitly.example/pricing):
  Available plans and pricing.

## Invitations

- [Create an Invitation](https://invitly.example/create):
  Create a digital event invitation.

- [Invitation Templates](https://invitly.example/templates):
  Browse available invitation templates.

## RSVP

- [RSVP](https://invitly.example/rsvp):
  Information about guest RSVP functionality.

## Documentation

- [Getting Started](https://invitly.example/docs/getting-started):
  Guide to creating your first event.

- [Guest Management](https://invitly.example/docs/guests):
  Manage event guests and RSVP responses.

## Resources

- [Blog](https://invitly.example/blog):
  Articles and guides about digital invitations and events.

## Legal

- [Privacy Policy](https://invitly.example/privacy):
  Privacy and data handling information.

- [Terms](https://invitly.example/terms):
  Terms of service.
```

---

# 8. Example: Developer/API project
For a developer product, a better structure could be:

```
# Example API

> REST API for managing customer accounts and orders.

Example API provides programmatic access to customer,
product, and order management functionality.

## Getting Started

- [Quick Start](https://example.com/docs/quickstart):
  Make your first API request.

- [Installation](https://example.com/docs/installation):
  Install and configure the SDK.

## Authentication

- [Authentication](https://example.com/docs/authentication):
  API key and OAuth authentication.

## API Reference

- [Customers](https://example.com/docs/api/customers):
  Customer API endpoints.

- [Orders](https://example.com/docs/api/orders):
  Order management endpoints.

- [Products](https://example.com/docs/api/products):
  Product API endpoints.

## Guides

- [Webhooks](https://example.com/guides/webhooks):
  Configure and consume webhook events.

- [Error Handling](https://example.com/guides/errors):
  Handle API errors and response codes.

## Resources

- [GitHub](https://github.com/example/api):
  Source code and examples.

- [Changelog](https://example.com/changelog):
  Product and API changes.
```

---

# 9. llms.txt vs robots.txt
These files have different purposes.

### robots.txt
Example:

```
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /
```
Main question:

> "Which parts of my website can automated crawlers access?"

### llms.txt
Example:

```
# My Product

> Cloud-based project management platform.

## Documentation

- [Getting Started](https://example.com/docs/start)
- [API Reference](https://example.com/docs/api)

## Guides

- [Deploying Projects](https://example.com/guides/deploy)
- [Authentication](https://example.com/guides/auth)
```
Main question:

> "What should an AI know about my website, and where is the important information?"
They are complementary, not replacements.

---

# 10. llms.txt vs sitemap.xml

### sitemap.xml
A sitemap tells search engines what URLs exist.

Example:

```
<urlset>
    <url>
        <loc>https://example.com/</loc>
    </url>

    <url>
        <loc>https://example.com/products</loc>
    </url>

    <url>
        <loc>https://example.com/docs</loc>
    </url>
</urlset>
```
Main purpose:

> URL discovery.

### llms.txt

```
# Example

> Example is a cloud monitoring platform.

## Documentation

- [Getting Started](https://example.com/docs/start):
  Learn how to configure monitoring.

- [API Reference](https://example.com/docs/api):
  Complete API documentation.
```
Main purpose:

> AI-oriented discovery + context.

---

# 11. What is llms-full.txt?
Some implementations also provide:

```
https://example.com/llms-full.txt
```
Conceptually:

### llms.txt
A concise index/map:

```
What is this project?

What are the important pages?

Where is the documentation?

Where is the API reference?
```

### llms-full.txt
A much more complete version:

```
What is this project?

+
Actual documentation/content
+
API details
+
Guides
+
Examples
```
`llms-full.txt` is particularly useful for documentation-heavy products.

---

# 12. Should every URL be included?
No.

`llms.txt` should be curated.

Avoid creating a huge list containing every page on the website.

Bad:

```
## Everything

- page1
- page2
- page3
- page4
...
- page1000
```
Better:

```
## Documentation

- [Getting Started](...)
- [Architecture](...)
- [API Reference](...)

## Core Features

- [PDF Compression](...)
- [PDF Merge](...)
- [PDF Split](...)
```
The goal is to identify the most useful and authoritative resources.

---

# 13. What should NOT be done?
Don't use `llms.txt` primarily as an SEO keyword-stuffing document.

Bad:

```
# Best PDF Tool

> Best free PDF tool online! Free PDF compressor!
> Best PDF merger! Free PDF editor! Online PDF tools!
```
Better:

```
# pdflare

> A privacy-focused PDF toolkit that processes files locally
> in the user's browser.
```
The goal is:

```
Accuracy
+
Clarity
+
Useful context
+
Authoritative links
```
not keyword manipulation.

---

# 14. Does llms.txt improve SEO?
It should not be treated as a guaranteed SEO ranking factor.

Its primary purpose is AI/LLM discoverability and context.

Traditional SEO still relies on things such as:

- Quality content
- Semantic HTML
- Metadata
- Internal linking
- Structured data
- Backlinks
- Sitemap
- Crawlability
- Page performance
- Search engine guidelines
`llms.txt` can be an additional layer.

A modern website can therefore have:

```
Website
│
├── robots.txt
│   └── Crawler access rules
│
├── sitemap.xml
│   └── URL discovery
│
├── llms.txt
│   └── AI-friendly site map + context
│
├── llms-full.txt
│   └── Expanded AI-friendly documentation
│
└── JSON-LD / Schema.org
    └── Structured semantic information
```

---

# 15. Will ChatGPT automatically use llms.txt?
Not necessarily.

`llms.txt` is a proposal/convention, not a universally enforced web standard.

Different AI systems have different:

- Crawlers
- Indexing systems
- Retrieval systems
- Browsing mechanisms
- Training pipelines
- Content policies
Therefore:

```
Publishing /llms.txt
        ≠
Guaranteed AI indexing
        ≠
Guaranteed ChatGPT visibility
        ≠
Guaranteed AI recommendations
```
Its purpose is to provide a standardized, machine-friendly resource that compatible AI systems can choose to consume.

---

# 16. Recommended setup for a modern website
For a project, a useful structure is:

```
/
├── robots.txt
├── sitemap.xml
├── llms.txt
├── llms-full.txt
└── ...
```
With:

```
robots.txt
    ↓
Crawler rules

sitemap.xml
    ↓
URL discovery

llms.txt
    ↓
AI-friendly index + context

llms-full.txt
    ↓
Expanded AI-friendly documentation
```

---

# 17. Example for pdflare
For a project such as `pdflare`, a good `llms.txt` could be:

```
# pdflare

> A privacy-focused, browser-based PDF toolkit that processes
> PDF files locally without requiring users to upload their
> documents to a server.

pdflare provides client-side PDF utilities for working with
documents directly in the browser. The project is designed
with privacy in mind, particularly for documents that users
may not want to upload to an online processing service.

## PDF Tools

- [PDF Compressor](https://pdflare.jowinjc.in/compress):
  Compress PDF documents directly in the browser.

- [PDF Merger](https://pdflare.jowinjc.in/merge):
  Combine multiple PDF documents into a single PDF.

- [PDF Splitter](https://pdflare.jowinjc.in/split):
  Split PDF documents into separate files.

- [PDF Tools](https://pdflare.jowinjc.in/tools):
  Browse available PDF utilities.

## About

- [Homepage](https://pdflare.jowinjc.in/):
  Overview of pdflare and its available tools.

## Privacy

- [Privacy](https://pdflare.jowinjc.in/privacy):
  Information about document processing and privacy.

## Project

- [GitHub Repository](https://github.com/...):
  Source code and project information.
```

---

# 18. Best-practice checklist
When creating `llms.txt`:

- Put it at `/llms.txt`
- Use Markdown
- Start with an H1 project/site name
- Add a concise blockquote description
- Explain the project in a few sentences
- Group resources with H2 headings
- Link to authoritative pages
- Add a short description for important links
- Prioritize documentation and core features
- Avoid unnecessary URLs
- Avoid keyword stuffing
- Keep information accurate and current
- Use canonical URLs
- Only link to pages that actually exist
- Consider `llms-full.txt` for large documentation sites
- Keep `robots.txt` and `sitemap.xml` as well
- Don't assume AI systems are required to consume it

---

# 19. Quick comparison
FilePurposeMain audience`robots.txt`Crawler access rulesSearch/AI crawlers`sitemap.xml`List/discover URLsSearch engines/crawlers`llms.txt`AI-friendly site map + contextLLM/AI systems`llms-full.txt`Expanded AI-friendly contentLLM/AI systemsJSON-LDDescribe entities/content semanticallySearch engines/AI systemsMeta descriptionShort page descriptionSearch engines/users
---

# 20. One-line definition
**`llms.txt` is a Markdown-based, AI-oriented guide placed at the root of a website that summarizes what the site is about and points LLMs toward its most important and authoritative content.**

The simplest mental model is:

```
robots.txt  = "What can you crawl?"
sitemap.xml = "What URLs exist?"
llms.txt    = "What is this site and what should you read?"
llms-full.txt = "Here is the fuller AI-readable content."
```

## Reference
Official proposal/documentation:

[https://llmstxt.org/](https://llmstxt.org/)

# llms.txt — guidance for SCORMite

`llms.txt` is an emerging, lightweight Markdown convention for sites to
provide a concise, machine-friendly summary of their content and important
links for Large Language Models and AI agents. SCORMite now generates an
`llms.txt` at build-time and serves one in dev; this document explains the
purpose and how to author or extend the file.

Why provide `llms.txt`?
- Reduces unnecessary crawl traffic by giving agents an explicit map of
  important pages and a short description of the site.
- Improves agent and LLM understanding of site scope and relevance.

SCORMite behavior
- During development, the Vite plugin serves `/llms.txt` from memory so
  local dev mirrors production behavior.
- During `pnpm run build`, `dist/llms.txt` is emitted. The plugin uses
  `src/shared/config/seo.ts`'s `llms` array to render the file. You can
  edit that file to adjust the list of models and the human-facing
  descriptions.

Authoring rules (recommended)
- File must be UTF-8 encoded and valid Markdown.
- Start with a short header and a one-line summary of the site purpose.
- Provide an ordered set of sections for important pages and resources.
- Include a model list if you wish to recommend model names to consumers.

Example `llms.txt` (SCORMite)

    # llms.txt

    SCORMite — offline-first developer toolkit for inspecting and testing
    SCORM packages. Drop a .zip and inspect runtime calls, CMI state,
    timeline replay, breakpoints, validation, and runtime profiling.

    ## site

    - Home: /
    - Sitemap: /sitemap.xml

    ## models

    ## gpt-4o-mini

    - Name: GPT-4o Mini
    - Description: Cost-efficient, general-purpose large language model for shorter requests.
    - URL: https://platform.openai.com/models/gpt-4o-mini

    ## gpt-4o

    - Name: GPT-4o
    - Description: High-capacity conversational model suitable for general reasoning and generation.
    - URL: https://platform.openai.com/models/gpt-4o

