# Deployment

Scormite is a static, browser-only application. It has no server API, database,
accounts, telemetry, or environment variables. Deploy the generated `dist/`
directory at the root of an HTTPS origin: the service worker requires a secure
context (localhost is also accepted by browsers).

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

The `_headers` and `_redirects` files in `public/` are also emitted to `dist/`,
so Cloudflare Pages deployments receive equivalent cache and SPA settings:

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
