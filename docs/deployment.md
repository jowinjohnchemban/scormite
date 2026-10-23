# Deployment

How to build and host SCORMite. It is a static, browser-only application —
no server API, database, accounts, or telemetry — so any static host works.
Recipes for some hosts follow; the requirements are the same everywhere.

## Requirements

- **Build:** `pnpm install --frozen-lockfile`, then `pnpm run build`. The
  output is `dist/`.
- **Serve `dist/` at the root of an HTTPS origin.** The service worker needs a
  secure context (browsers also accept localhost), and package content and
  the service worker use root-relative URLs, so the app cannot live in a
  sub-path.
- **Single-page-app fallback:** requests for paths that are not files get
  `index.html`.
- **Cache policy:** see [below](#cache-policy). `public/_headers` (emitted to
  `dist/`) expresses it for hosts that read that file.

## Build settings

All optional; set them as build-time environment variables.

| Variable                          | Effect                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_SITE_URL` (or `SITE_URL`)   | The public origin used for the canonical link, Open Graph / Twitter image URLs, JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt`. Defaults to the origin in `src/shared/config/seo.ts`; set it when deploying under another domain.          |
| `SEO_INDEX` (or `VITE_SEO_INDEX`) | `false` keeps search engines out of the deployment; `true` lets them in. Set `false` for preview and staging builds on hosts not listed below.                                                                                                   |
| `WEBMCP_ORIGIN_TRIAL_TOKENS`      | Origin-trial tokens that enable WebMCP for AI agents in Chrome and Edge while it is on trial; comma-separated, each registered for this deployment's origin. Without them, WebMCP works only where the browser enables it by default or by flag. |
| `SEO_PRODUCTION_BRANCH`           | On Cloudflare, the branch whose builds are production (default `main`).                                                                                                                                                                          |

Unset, `SEO_INDEX` is decided from the platforms that announce a preview
build: Cloudflare Workers Builds and Pages (a branch other than the production
branch), Vercel (`VERCEL_ENV` other than `production`), and Netlify
(`CONTEXT` other than `production`). Every other build is indexed.

## Search engines and AI assistants

The build generates these files; nothing in `public/` needs editing:

| File                                                               | Contents                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.txt`                                                       | Allows the app, keeps crawlers out of `/scorm-files/`, and points to the sitemap. On a deployment that must not be indexed: `Disallow: /`, and the page carries `noindex, nofollow`.                                  |
| `sitemap.xml`                                                      | Every HTML page the build emits. `lastmod` is the date of the last commit that changed the page (`index.html`, `src/`, `public/`); without git history — a container build, which leaves out `.git` — the build date. |
| `llms.txt`                                                         | What SCORMite is, its features and FAQ (from the SEO config), and a link to each published document with its opening paragraph.                                                                                       |
| `about/index.html`, `licenses.txt`                                 | The About page (developer credit, build, architecture, open-source packages) and the full licence texts of the packages the build ships. Listed in the sitemap like any other page.                                   |
| `llms-full.txt`                                                    | The same summary followed by the full text of every published document.                                                                                                                                               |
| `docs/user-guide.md`, `docs/scorm-support.md`, `docs/ai-agents.md` | The published documents (the `docs` list in the SEO config), served as Markdown. Their relative links may only point at each other; the build fails otherwise.                                                        |

## Hosts

**Cloudflare Workers.** `wrangler.jsonc` deploys `dist/` as static Worker
assets with SPA fallback; `_headers` is applied. With Workers Builds
(repository connected in the dashboard), use build command `pnpm run build`,
deploy command `npx wrangler deploy`, and, for preview URLs per branch,
non-production branch deploy command `npx wrangler versions upload`. By hand:

```bash
pnpm run build
pnpm dlx wrangler deploy
```

**Cloudflare Pages.** Build command `pnpm run build`, output directory
`dist`; `_headers` is applied, and Pages provides SPA fallback when no
top-level `404.html` is deployed. By hand:

```bash
pnpm run build
pnpm dlx wrangler pages deploy dist --project-name scormite
```

**Vercel.** `vercel.json` configures pnpm's locked install, the build, SPA
fallback routing, and cache headers. Import the repository or run
`pnpm dlx vercel`.

**Container.** The multi-stage `Dockerfile` builds the app with its locked
dependency tree and serves only static output from an unprivileged Nginx
process on port 8080 (`deploy/nginx.conf`):

```bash
docker compose up --build
```

Open `http://localhost:8080`; behind a reverse proxy, keep the app at the
origin root.

**Anywhere else** (Netlify, object storage behind a CDN,
your own web server): build with the command above, publish `dist/`, and
configure the SPA fallback and cache policy the host's way.

## Cache policy

`/assets/*` is immutable because Vite fingerprints those filenames. `index.html`
and `/sw.js` are revalidated on each request so a deployment can update the app
and service worker without users being stranded on an old shell.
