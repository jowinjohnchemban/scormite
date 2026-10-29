/**
 * Tells IndexNow (https://www.indexnow.org) which pages of the live site
 * changed, so Bing, Yandex, Naver, Seznam, Yep, and the engines built on Bing
 * re-crawl them within minutes instead of days. Run by
 * .github/workflows/indexnow.yml after each push to main — never in the app.
 *
 * Crawl, then submit only what changed:
 *  1. With COMMIT set to the pushed commit: while the previous version is
 *     still live, crawl it (the "before"), then wait until /build.json
 *     reports the new commit, so engines never fetch the old version.
 *  2. Crawl every page in the live sitemap and fingerprint what a crawler
 *     reads. Hashed asset file names and the About page's build commit and date
 *     change with every build, so they are left out.
 *  3. Submit the pages that differ from the "before" crawl or from the last
 *     successful run's crawl (SNAPSHOT, kept in the Actions cache while it
 *     lasts; until one succeeds, the "before" crawl stands in). Pages they
 *     had that the sitemap no longer lists are submitted only when they
 *     answer 404, 410, or a redirect: the SPA fallback's 200 would not make
 *     engines drop them. With neither to compare against, or with
 *     SUBMIT_ALL, submit every page.
 *
 * Node built-ins only:
 *   COMMIT=abc1234 node build/indexnow.ts   after a deploy (pnpm run indexnow)
 *   SUBMIT_ALL=1 node build/indexnow.ts     every page, now
 *   DRY_RUN=1 node build/indexnow.ts        show what would be submitted, send and save nothing
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSeoConfig } from '../src/shared/config/seo.ts'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const POLL_MS = 20_000
const CRAWLERS = 4

/** The volatile part of /build.json (`BuildInfo` in build/aboutPage.ts). */
export interface LiveBuild {
  commit: string | null
  date: string | null
}

/** Page URL → fingerprint of its content. */
export type Fingerprints = Record<string, string>

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

/** The page URLs a sitemap lists. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1]!.trim().replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name: string) => XML_ENTITIES[name]!),
  )
}

/**
 * A fingerprint of what a crawler reads on a page. The hashed file names of
 * /assets/ are masked (they change with every build even when the words do
 * not), and the build's commit and date, which the About page shows, dropped.
 */
export function fingerprint(html: string, build: LiveBuild | null): string {
  let content = html.replace(/"\/assets\/[^"]*"/g, '"/assets/"')
  for (const value of [build?.commit, build?.date]) {
    if (value) content = content.replaceAll(value, '')
  }
  return createHash('sha256').update(content).digest('hex')
}

/**
 * The listed pages to submit: those that differ from any reference crawl (a
 * page missing from one counts as changed). Every page with SUBMIT_ALL, or
 * with nothing to compare against, so a change is never missed.
 */
export function changedPages(
  urls: readonly string[],
  current: Fingerprints,
  references: readonly Fingerprints[],
  submitAll: boolean,
): string[] {
  if (submitAll || references.length === 0) return [...urls]
  return urls.filter((url) => references.some((reference) => reference[url] !== current[url]))
}

/** Pages a reference crawl had that the sitemap no longer lists. */
export function removedPages(urls: readonly string[], references: readonly Fingerprints[]): string[] {
  const listed = new Set(urls)
  return [...new Set(references.flatMap((reference) => Object.keys(reference)))].filter((url) => !listed.has(url))
}

/**
 * Whether a removed page's HTTP status tells engines to drop it: 404 or 410,
 * or a redirect to its replacement. A 200 (the SPA fallback serving the app)
 * would not, so such a page is not worth submitting.
 */
export function signalsRemoval(status: number): boolean {
  return status === 404 || status === 410 || (status >= 300 && status < 400)
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`)
  return response.text()
}

/** The live build, or null while /build.json is missing (the SPA fallback answers with HTML). */
async function liveBuild(origin: string): Promise<LiveBuild | null> {
  try {
    const body = JSON.parse(await fetchText(`${origin}/build.json`)) as Record<string, unknown>
    const text = (value: unknown) => (typeof value === 'string' ? value : null)
    return { commit: text(body['commit']), date: text(body['date']) }
  } catch {
    return null
  }
}

async function waitForDeploy(origin: string, commit: string, waitMs: number): Promise<void> {
  const deadline = Date.now() + waitMs
  for (;;) {
    const live = (await liveBuild(origin))?.commit ?? null
    if (live === commit) return
    if (Date.now() > deadline) {
      throw new Error(
        `The live site still reports ${live ?? 'no build'} after ${waitMs / 60_000} minutes, not ${commit}.`,
      )
    }
    console.log(`Waiting for ${commit} to go live (live: ${live ?? 'unknown'})…`)
    await sleep(POLL_MS)
  }
}

/** Every page in the live sitemap, crawled a few at a time. */
async function crawl(origin: string, build: LiveBuild | null): Promise<{ urls: string[]; prints: Fingerprints }> {
  const urls = sitemapUrls(await fetchText(`${origin}/sitemap.xml`))
  if (urls.length === 0) throw new Error(`${origin}/sitemap.xml lists no pages.`)
  const prints: Fingerprints = {}
  const queue = [...urls]
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) prints[url] = fingerprint(await fetchText(url), build)
  }
  await Promise.all(Array.from({ length: CRAWLERS }, worker))
  return { urls, prints }
}

async function submit(origin: string, key: string, urlList: readonly string[]): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(origin).host, key, urlList }),
  })
  // 200: accepted; 202: accepted, key validation pending.
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow answered ${response.status}: ${await response.text()}`)
  }
  console.log(`Submitted ${urlList.length} URL(s) to IndexNow (${response.status}).`)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** The saved crawl to compare against, or null when there is none. */
function readSnapshot(file: string): Fingerprints | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Fingerprints
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

const writeSnapshot = (file: string, prints: Fingerprints) =>
  writeFileSync(file, `${JSON.stringify(prints, null, 2)}\n`)

async function main(env: NodeJS.ProcessEnv): Promise<void> {
  const key = siteSeoConfig.indexNowKey
  if (!key) {
    console.log('IndexNow is off (indexNowKey is null in src/shared/config/seo.ts).')
    return
  }
  const origin = siteSeoConfig.siteUrl.replace(/\/$/, '')
  const flag = (name: string) => env[name] === '1' || env[name] === 'true'
  const submitAll = flag('SUBMIT_ALL')
  const dryRun = flag('DRY_RUN')
  const snapshotFile = path.resolve(env['SNAPSHOT'] || '.indexnow-snapshot.json')
  // The last successful run's crawl, while the Actions cache keeps it (7 days
  // unused). It also retries a submission that failed.
  const saved = readSnapshot(snapshotFile)

  // The "before" picture, needing no storage: a run starts seconds after the
  // push, while the host is still building, so the previous version is live.
  const commit = env['COMMIT']?.slice(0, 7)
  let before: Fingerprints | null = null
  const previous = await liveBuild(origin)
  if (commit && previous?.commit !== commit) {
    before = (await crawl(origin, previous)).prints
    // A deploy that went live mid-crawl leaves a mix of both versions.
    if ((await liveBuild(origin))?.commit !== previous?.commit) before = null
    // With no earlier crawl, keep this one in its place, so that if this run
    // fails (the cache is saved either way), the next one still compares
    // against the old version.
    if (before && saved === null && !dryRun) writeSnapshot(snapshotFile, before)
    await waitForDeploy(origin, commit, Number(env['WAIT_MINUTES'] || 15) * 60_000)
  }

  const keyFile = `${origin}/${key}.txt`
  if ((await fetchText(keyFile)).trim() !== key)
    throw new Error(`${keyFile} does not serve the key; engines would reject it.`)

  const { urls, prints: current } = await crawl(origin, await liveBuild(origin))
  const references = [before, saved].filter((reference) => reference !== null)
  const changed = changedPages(urls, current, references, submitAll)
  for (const url of removedPages(urls, references)) {
    const { status } = await fetch(url, { cache: 'no-store', redirect: 'manual' })
    if (signalsRemoval(status)) changed.push(url)
    else {
      console.log(
        `::warning::${url} left the sitemap but still answers ${status}, so it is not submitted. Serve 404 or 410, or redirect it, for engines to drop it.`,
      )
    }
  }

  if (changed.length === 0) {
    console.log(`Crawled ${urls.length} pages: none changed, nothing to submit.`)
  } else {
    const why = references.length === 0 && !submitAll ? ' (nothing to compare with, so every page)' : ''
    console.log(`Crawled ${urls.length} pages; submitting ${changed.length}${why}:\n  ${changed.join('\n  ')}`)
    if (dryRun) {
      console.log('Dry run: nothing sent, nothing saved.')
      return
    }
    await submit(origin, key, changed)
  }
  // Saved only after a successful submission, so a failed one is retried next time.
  if (!dryRun) writeSnapshot(snapshotFile, current)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.env).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
