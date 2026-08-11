# Progress Notes — Short-term

Date: 2026-08-11

Summary
-------

- Implemented project-level SEO/static-file support and a small Vite plugin
  to generate `robots.txt`, `sitemap.xml`, and `llms.txt` during build and
  to serve the same files during local dev. This lives in `vite.config.ts` and
  is driven by `src/shared/config/seo.ts`.

Files changed
-------------

- `src/shared/config/seo.ts` — new fields: `siteUrl`, `routes`, `llms`.
- `vite.config.ts` — added `scormite-seo-static` plugin: `transformIndexHtml`,
  dev middleware handlers, and build-time asset emission.

What works now
-------------

- `pnpm run build` emits `dist/robots.txt`, `dist/sitemap.xml`, and
  `dist/llms.txt` with values taken from `siteSeoConfig`.
- Dev server (`pnpm run dev`) serves the same endpoints at `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.

Next steps (later continuation)
-------------------------------

1. Wire `siteUrl` to CI/deploy environment via `VITE_SITE_URL` or `SITE_URL`.
2. Expand `routes` to include any dynamic/public routes (e.g., per-package
   landing pages) to make a complete `sitemap.xml`.
3. Consider pulling `llms` from a maintained config or remote source if it
   needs to be updated without a deploy.
4. Add a small test that validates `dist/` contains the expected files in CI.
5. Optionally, expose site metadata into the React app's head tags centrally
   so runtime meta changes reflect `siteSeoConfig`.

If you'd like I can draft a PR with these docs changes and include a CI test
that checks for the presence and contents of the generated files.
