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
const NOW = () => Promise.resolve()

interface Call {
  method: string
  url: string
  body: Record<string, unknown> | null
  headers: Record<string, string>
}

/**
 * A fake GitHub: `main` points at `head`, a created deployment gets id 42, and
 * `statuses` lists the HTTP status for each answer to a status POST, in order
 * (the last repeats).
 */
function stubGitHub({ head = ENV.COMMIT, statuses = [201] }: { head?: string; statuses?: number[] } = {}) {
  const calls: Call[] = []
  let statusPosts = 0
  const send = vi.fn((url: string, init: RequestInit) => {
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null
    calls.push({ method: init.method ?? 'GET', url, body, headers: init.headers as Record<string, string> })
    if (url.endsWith('/git/ref/heads/main')) return Promise.resolve(Response.json({ object: { sha: head } }))
    if (url.endsWith('/statuses')) {
      const status = statuses[Math.min(statusPosts++, statuses.length - 1)] ?? 201
      return Promise.resolve(Response.json({}, { status }))
    }
    return Promise.resolve(Response.json({ id: 42 }, { status: 201 }))
  })
  return { calls, send: send as unknown as typeof fetch }
}

describe('recordDeployment', () => {
  it('creates a production deployment for the commit and marks it live once the site reports it', async () => {
    const { calls, send } = stubGitHub()
    const wait = vi.fn(() => Promise.resolve())
    await recordDeployment(ENV, ORIGIN, send, wait, NOW)

    expect(wait).toHaveBeenCalledWith(ORIGIN, 'abcdef1', 15 * 60_000)
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.github.com/repos/owner/repo/deployments',
      'POST https://api.github.com/repos/owner/repo/deployments/42/statuses',
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
    await expect(recordDeployment({ ...ENV, WAIT_MINUTES: '1' }, ORIGIN, send, wait, NOW)).rejects.toThrow(
      'still serving the old build',
    )

    expect(wait).toHaveBeenCalledWith(ORIGIN, 'abcdef1', 60_000)
    const status = calls.at(-1)
    expect(status?.url).toMatch(/\/deployments\/42\/statuses$/)
    expect(status?.body).toMatchObject({ state: 'failure' })
    expect(status?.body).not.toHaveProperty('environment_url')
  })

  it('records nothing for a commit that a newer push replaced before it went live', async () => {
    const { calls, send } = stubGitHub({ head: '9999999aaaaaaa' })
    const wait = vi.fn(() => Promise.reject(new Error('never went live')))
    await recordDeployment(ENV, ORIGIN, send, wait, NOW)

    expect(calls.map((call) => call.method)).toEqual(['GET'])
  })

  it('tries again when GitHub itself fails', async () => {
    const { calls, send } = stubGitHub({ statuses: [503, 502, 201] })
    const pause = vi.fn(NOW)
    await recordDeployment(ENV, ORIGIN, send, () => Promise.resolve(), pause)

    expect(calls.filter((call) => call.url.endsWith('/statuses'))).toHaveLength(3)
    expect(pause).toHaveBeenCalledTimes(2)
  })

  it('gives up after repeated GitHub failures and reports the failed wait as well', async () => {
    const { send } = stubGitHub({ statuses: [503] })
    const wait = vi.fn(() => Promise.reject(new Error('still serving the old build')))
    const result = recordDeployment(ENV, ORIGIN, send, wait, NOW)

    await expect(result).rejects.toThrow('still serving the old build')
    await expect(result).rejects.toThrow('GitHub answered 503 for deployments/42/statuses')
  })

  it('does not retry a request GitHub refuses', async () => {
    const send = vi.fn(() => Promise.resolve(new Response('Resource not accessible', { status: 403 })))
    const pause = vi.fn(NOW)
    await expect(
      recordDeployment(ENV, ORIGIN, send as unknown as typeof fetch, () => Promise.resolve(), pause),
    ).rejects.toThrow('GitHub answered 403 for deployments')

    expect(send).toHaveBeenCalledTimes(1)
    expect(pause).not.toHaveBeenCalled()
  })

  it.each(['soon', '0', '-5', 'Infinity'])('rejects WAIT_MINUTES=%s before waiting', async (minutes) => {
    const wait = vi.fn(() => Promise.resolve())
    await expect(recordDeployment({ ...ENV, WAIT_MINUTES: minutes }, ORIGIN, undefined, wait, NOW)).rejects.toThrow(
      'WAIT_MINUTES must be a positive number',
    )
    expect(wait).not.toHaveBeenCalled()
  })

  it('names the setting that is missing', async () => {
    await expect(recordDeployment({}, ORIGIN, undefined, () => Promise.resolve(), NOW)).rejects.toThrow(
      'GITHUB_TOKEN is not set.',
    )
  })
})
