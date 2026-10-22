# Deployment

SCORMite is a static, browser-only application. It has no server API, database,
accounts, or telemetry. Deploy the generated `dist/` directory at the root of an
HTTPS origin: the service worker requires a secure context (localhost is also
accepted by browsers).

Two build-time settings are optional:

| Variable | Effect |
|---|---|
| `VITE_SITE_URL` (or `SITE_URL`) | The public origin used for the canonical link, Open Graph / Twitter image URLs, JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt`. Defaults to the production origin in `src/shared/config/seo.ts`; set it for preview or staging deployments so their metadata does not point at production. |
| `SEO_INDEX` (or `VITE_SEO_INDEX`) | `false` keeps search engines out of the deployment; `true` lets them in. Unset, Vercel preview and development builds are kept out and every other build is indexed. |

## Search engines and AI assistants

The build generates these files; nothing in `public/` needs editing:

| File | Contents |
|---|---|
| `robots.txt` | Allows the app, keeps crawlers out of `/scorm-files/`, and points to the sitemap. On a deployment that must not be indexed: `Disallow: /`, and the page carries `noindex, nofollow`. |
| `sitemap.xml` | Every HTML page the build emits. `lastmod` is the date of the last commit that changed the page (`index.html`, `src/`, `public/`); without git history — a container build, which leaves out `.git` — the build date. |
| `llms.txt` | What SCORMite is, its features and FAQ (from the SEO config), and a link to each published document with its opening paragraph. |
| `llms-full.txt` | The same summary followed by the full text of every published document. |
| `docs/user-guide.md`, `docs/scorm-support.md` | The published documents (the `docs` list in the SEO config), served as Markdown. Their relative links may only point at each other; the build fails otherwise. |

## Vercel

`vercel.json` configures pnpm's locked install, the Vite production build, SPA
fallback routing, and cache headers. Import the repository into Vercel or run:

```bash
pnpm dlx vercel
```

## Cloudflare

`wrangler.jsonc` deploys the Vite `dist/` output as static Worker assets with
single-page-app fallback routing:

```bash
pnpm run build
pnpm dlx wrangler deploy
```

The `_headers` file in `public/` is also emitted to `dist/`, so Cloudflare Pages
deployments receive the same cache policy. Cloudflare Pages provides SPA fallback
when no top-level `404.html` is deployed:

```bash
pnpm run build
pnpm dlx wrangler pages deploy dist --project-name scormite
```

## Self-hosted container

The multi-stage `Dockerfile` builds the app with its locked pnpm dependency tree
and serves only static output from an unprivileged Nginx process on port 8080.

```bash
docker compose up --build
```

Open `http://localhost:8080`. For a reverse proxy, retain the application at
the origin root: package content and the service worker use root-relative URLs.

## Cache policy

`/assets/*` is immutable because Vite fingerprints those filenames. `index.html`
and `/sw.js` are revalidated on each request so a deployment can update the app
and service worker without users being stranded on an old shell.
