/**
 * What the deployment script sends to GitHub: a deployment for the pushed
 * commit, then a status that says whether the live site reported it.
 */

import { describe, expect, it, vi } from 'vitest'
import { recordDeployment } from './githubDeployment.js'

const ENV = {
  GITHUB_TOKEN: 'token',
  GITHUB_REPOSITORY: 'owner/repo',
  COMMIT: 'abcdef1234567890',
  RUN_URL: 'https://github.com/owner/repo/actions/runs/1',
}
const ORIGIN = 'https://example.test'

/** A fetch that answers every POST with a created deployment, and keeps what it was sent. */
function stubGitHub() {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = []
  const send = vi.fn((url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
    })
    return Promise.resolve(Response.json({ id: 42 }, { status: 201 }))
  })
  return { calls, send: send as unknown as typeof fetch }
}

describe('recordDeployment', () => {
  it('creates a production deployment for the commit and marks it live once the site reports it', async () => {
    const { calls, send } = stubGitHub()
    const wait = vi.fn(() => Promise.resolve())
    await recordDeployment(ENV, ORIGIN, send, wait)

    expect(wait).toHaveBeenCalledWith(ORIGIN, 'abcdef1', 15 * 60_000)
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.github.com/repos/owner/repo/deployments',
      'https://api.github.com/repos/owner/repo/deployments/42/statuses',
    ])
    expect(calls[0]?.headers['Authorization']).toBe('Bearer token')
    expect(calls[0]?.body).toMatchObject({
      ref: ENV.COMMIT,
      environment: 'Production',
      production_environment: true,
      required_contexts: [],
    })
    expect(calls[1]?.body).toMatchObject({
      state: 'success',
      environment_url: ORIGIN,
      log_url: ENV.RUN_URL,
    })
  })

  it('marks the deployment failed, then fails the run, when the site never reports the commit', async () => {
    const { calls, send } = stubGitHub()
    const wait = vi.fn(() => Promise.reject(new Error('still serving the old build')))
    await expect(recordDeployment({ ...ENV, WAIT_MINUTES: '1' }, ORIGIN, send, wait)).rejects.toThrow(
      'still serving the old build',
    )

    expect(wait).toHaveBeenCalledWith(ORIGIN, 'abcdef1', 60_000)
    expect(calls[1]?.body).toMatchObject({ state: 'failure' })
    expect(calls[1]?.body).not.toHaveProperty('environment_url')
  })

  it('reports a GitHub error instead of carrying on', async () => {
    const send = vi.fn(() => Promise.resolve(new Response('Resource not accessible', { status: 403 })))
    await expect(
      recordDeployment(ENV, ORIGIN, send as unknown as typeof fetch, () => Promise.resolve()),
    ).rejects.toThrow('GitHub answered 403 for deployments')
  })

  it('names the setting that is missing', async () => {
    await expect(recordDeployment({}, ORIGIN, undefined, () => Promise.resolve())).rejects.toThrow(
      'GITHUB_TOKEN is not set.',
    )
  })
})
