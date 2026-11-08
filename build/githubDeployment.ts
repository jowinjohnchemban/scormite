/**
 * Records each deploy of main as a GitHub deployment, so the repository lists
 * a "Production" environment with the live site's link. The host builds and
 * deploys by itself; Cloudflare Workers Builds reports only a check run, which
 * GitHub's Deployments list does not show. Run by
 * .github/workflows/deployment.yml after each push to main — never in the app.
 *
 * Waits until /build.json reports the pushed commit (the same wait IndexNow
 * uses), then creates the deployment and marks it successful. If the live site
 * never reports the commit, it marks the deployment failed and the run fails.
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

type Env = Readonly<Record<string, string | undefined>>
type Wait = (origin: string, commit: string, waitMs: number) => Promise<void>

function required(env: Env, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is not set.`)
  return value
}

/** Creates the deployment for COMMIT once it is live (or has failed to go live) and sets its status. */
export async function recordDeployment(
  env: Env,
  origin: string,
  send: typeof fetch = fetch,
  wait: Wait = waitForDeploy,
): Promise<void> {
  const token = required(env, 'GITHUB_TOKEN')
  const repository = required(env, 'GITHUB_REPOSITORY')
  const sha = required(env, 'COMMIT')
  const logUrl = env['RUN_URL']

  let failure: unknown = null
  try {
    // /build.json reports the 7-character commit.
    await wait(origin, sha.slice(0, 7), Number(env['WAIT_MINUTES'] || 15) * 60_000)
  } catch (error) {
    failure = error
  }

  const post = async (endpoint: string, body: object): Promise<{ id?: number }> => {
    const response = await send(`${API}/repos/${repository}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${endpoint}: ${await response.text()}`)
    return (await response.json()) as { id?: number }
  }

  const { id } = await post('deployments', {
    ref: sha,
    environment: ENVIRONMENT,
    description: 'Deployed by the hosting platform',
    production_environment: true,
    transient_environment: false,
    auto_merge: false,
    required_contexts: [], // the build's checks need not pass first: the host already deployed it
  })
  if (typeof id !== 'number') throw new Error('GitHub did not create a deployment.')

  await post(`deployments/${id}/statuses`, {
    state: failure ? 'failure' : 'success',
    description: failure ? 'The live site never reported this commit' : 'Live',
    environment: ENVIRONMENT,
    ...(failure ? {} : { environment_url: origin }),
    ...(logUrl ? { log_url: logUrl } : {}),
  })

  if (failure) throw failure
  console.log(`Recorded ${sha.slice(0, 7)} as deployed to ${origin}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  recordDeployment(process.env, siteSeoConfig.siteUrl.replace(/\/$/, '')).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
