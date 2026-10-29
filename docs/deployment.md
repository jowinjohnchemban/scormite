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

The build generates these files; nothing in `public/` needs editing except
the [IndexNow](#indexnow) key file:

| File                                                               | Contents                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.txt`                                                       | Allows the app, keeps crawlers out of `/scorm-files/`, and points to the sitemap. On a deployment that must not be indexed: `Disallow: /`, and the page carries `noindex, nofollow`.                                  |
| `sitemap.xml`                                                      | Every HTML page the build emits. `lastmod` is the date of the last commit that changed the page (`index.html`, `src/`, `public/`); without git history — a container build, which leaves out `.git` — the build date. |
| `llms.txt`                                                         | What SCORMite is, its features and FAQ (from the SEO config), and a link to each published document with its opening paragraph.                                                                                       |
| `about/index.html`, `licenses.txt`                                 | The About page (developer credit, build, architecture, open-source packages) and the full licence texts of the packages the build ships. Listed in the sitemap like any other page.                                   |
| `llms-full.txt`                                                    | The same summary followed by the full text of every published document.                                                                                                                                               |
| `docs/user-guide.md`, `docs/scorm-support.md`, `docs/ai-agents.md` | The published documents (the `docs` list in the SEO config), served as Markdown. Their relative links may only point at each other; the build fails otherwise.                                                        |
| `build.json`                                                       | The build the About page shows (commit and date), for machines: [IndexNow](#indexnow) reads which commit is live.                                                                                                     |

### IndexNow

After each push to `main` that changes what the pages are built from,
`.github/workflows/indexnow.yml` runs `build/indexnow.ts` to tell
[IndexNow](https://www.indexnow.org) engines (Bing, Yandex, Naver, Seznam,
Yep, and the engines built on Bing) which pages changed, so they re-crawl
them within minutes. It crawls the old version while the host is still
building, waits until `/build.json` reports the pushed commit, crawls the
live sitemap again, and submits only the pages whose content differs. Hashed
asset file names and the About page's build commit and date are ignored. The
crawl to compare against is kept in the Actions cache, also when a run fails,
so the next run submits what a failed one did not; with nothing to compare
against (an empty cache, and a deploy that finished before the run started),
every page is submitted.

A page that leaves the sitemap is submitted only if it answers 404, 410, or a
redirect, which tells engines to drop it. The SPA fallback answers any other
path with the app and a 200, so the run warns instead, and keeps checking the
page on later runs until it does: to retire a page, redirect it (or serve a 404) on the host.

Run it by hand from **Actions → IndexNow** (tick _Submit every page_ to
resubmit everything). Locally, `DRY_RUN=1 pnpm run indexnow` shows what it
would submit and sends and saves nothing. A fresh checkout has no saved
crawl, so it lists every page; to see only the pages changed since a crawl,
point `SNAPSHOT` at that crawl's JSON file (the workflow's is
`.indexnow-snapshot.json`).

The key is `indexNowKey` in `src/shared/config/seo.ts`, and
`public/<key>.txt` holds exactly the key (no trailing newline) to prove the
site owns it; a unit test keeps the two in step. The key is public by design.
To replace it, change both; set `indexNowKey` to `null` and delete the file
to turn IndexNow off. A fork deployed under another domain should do one or
the other, because the script submits for the origin in the SEO config.

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
