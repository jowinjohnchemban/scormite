# Milestone: Static SEO & Build Assets

**Status:** In-progress / implemented (dev + build) — follow-up tasks remain

Description
-----------

Provide canonical site metadata and small static artifacts (`robots.txt`,
`llms.txt`, `sitemap.xml`) that the site needs for crawlers and for
maintaining an LLM allowlist. These files are generated from a shared
`siteSeoConfig` and emitted at build-time. During `vite` dev, the plugin
serves the same content over dev middleware so the local environment matches
production expectations.

Files delivered
---------------

- `src/shared/config/seo.ts` — central site SEO configuration (title,
  description, siteUrl, routes, llms list)
- `vite.config.ts` — `scormite-seo-static` Vite plugin (HTML injection plus
  dev middleware + build asset emission)

Exit criteria (remaining)
-------------------------

- Add a CI step to assert `dist/robots.txt`, `dist/sitemap.xml`, and
  `dist/llms.txt` exist and contain the expected canonical host.
- Update deployment pipelines to provide `VITE_SITE_URL`/`SITE_URL` so
  `siteUrl` can be overridden per-environment.
- Optionally, expand `routes` to include other public pages and ensure
  sitemap generation covers them.
