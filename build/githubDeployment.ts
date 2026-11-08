/**
 * Records each deploy of main as a GitHub deployment, so the repository lists
 * a "Production" environment with the live site's link. The host builds and
 * deploys by itself; Cloudflare Workers Builds reports only a check run, which
 * GitHub's Deployments list does not show. Run by
 * .github/workflows/deployment.yml after each push to main — never in the app.
 *
 * Waits until /build.json reports the pushed commit (the same wait IndexNow
 * uses), then creates the deployment and marks it successful. If the live site
 * never reports the commit, it marks the deployment failed and the run fails —
 * unless main has moved on, in which case a newer push replaced the commit
 * before it went live and there is nothing to record.
 *
 * Node built-ins only:
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo COMMIT=<full sha> RUN_URL=… node build/githubDeployment.ts
 *   WAIT_MINUTES   how long to wait for the deploy (default 15)
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteSeoConfig } from '../src/shared/config/seo.ts'
import { waitForDeploy } from './indexnow.ts'

const API = 'https://api.github.com'
const ENVIRONMENT = 'Production'
const BRANCH = 'main'
const ATTEMPTS = 3

type Env = Readonly<Record<string, string | undefined>>
type Wait = (origin: string, commit: string, waitMs: number) => Promise<void>
type Pause = (ms: number) => Promise<void>

const sleep: Pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

function required(env: Env, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is not set.`)
  return value
}

/** Minutes to wait for the deploy; a value that is not a positive number would never time out. */
function waitMinutes(env: Env): number {
  const minutes = Number(env['WAIT_MINUTES'] || 15)
  if (!Number.isFinite(minutes) || minutes <= 0)
    throw new Error(`WAIT_MINUTES must be a positive number of minutes, not "${env['WAIT_MINUTES']}".`)
  return minutes
}

/** Creates the deployment for COMMIT once it is live (or has failed to go live) and sets its status. */
export async function recordDeployment(
  env: Env,
  origin: string,
  send: typeof fetch = fetch,
  wait: Wait = waitForDeploy,
  pause: Pause = sleep,
): Promise<void> {
  const token = required(env, 'GITHUB_TOKEN')
  const repository = required(env, 'GITHUB_REPOSITORY')
  const sha = required(env, 'COMMIT')
  const logUrl = env['RUN_URL']
  const waitMs = waitMinutes(env) * 60_000

  /** A GitHub API call, tried again when GitHub itself fails (a 5xx). */
  const call = async (method: 'GET' | 'POST', endpoint: string, body?: object): Promise<{ id?: number }> => {
    for (let attempt = 1; ; attempt++) {
      const response = await send(`${API}/repos/${repository}/${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (response.ok) return (await response.json()) as { id?: number }
      if (response.status < 500 || attempt === ATTEMPTS)
        throw new Error(`GitHub answered ${response.status} for ${endpoint}: ${await response.text()}`)
      await pause(attempt * 2_000)
    }
  }

  let failure: unknown = null
  try {
    // /build.json reports the 7-character commit.
    await wait(origin, sha.slice(0, 7), waitMs)
  } catch (error) {
    failure = error
    // Pushes are handled one run each, so a commit that a newer push replaced
    // before the host served it is not a failed deploy: it was never going to be live.
    const head = await call('GET', `git/ref/heads/${BRANCH}`)
      .then((ref) => (ref as { object?: { sha?: string } }).object?.sha)
      .catch(() => sha) // cannot tell: record the failure
    if (head !== sha) {
      console.log(`${sha.slice(0, 7)} was replaced by a newer push before it went live; nothing to record.`)
      return
    }
  }

  try {
    const { id } = await call('POST', 'deployments', {
      ref: sha,
      environment: ENVIRONMENT,
      description: 'Deployed by the hosting platform',
      production_environment: true,
      transient_environment: false,
      auto_merge: false,
      required_contexts: [], // the build's checks need not pass first: the host already deployed it
    })
    if (typeof id !== 'number') throw new Error('GitHub did not create a deployment.')

    await call('POST', `deployments/${id}/statuses`, {
      state: failure ? 'failure' : 'success',
      description: failure ? 'The live site never reported this commit' : 'Live',
      environment: ENVIRONMENT,
      ...(failure ? {} : { environment_url: origin }),
      ...(logUrl ? { log_url: logUrl } : {}),
    })
  } catch (error) {
    if (!failure) throw error
    throw new Error(`${describe(failure)} Recording that failure failed too: ${describe(error)}`, { cause: error })
  }

  if (failure) throw failure
  console.log(`Recorded ${sha.slice(0, 7)} as deployed to ${origin}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  recordDeployment(process.env, siteSeoConfig.siteUrl.replace(/\/$/, '')).catch((error: unknown) => {
    console.error(describe(error))
    process.exitCode = 1
  })
}
