/**
 * Origin-trial tokens let a deployment use a browser feature that is still on
 * trial — here WebMCP (Chrome and Edge origin trials). Tokens are tied to the
 * site's origin, so they are a build setting, not part of the code:
 * `WEBMCP_ORIGIN_TRIAL_TOKENS` holds one or more, separated by commas. Each
 * becomes an `<meta http-equiv="origin-trial">` tag on every page.
 */

import type { HtmlTagDescriptor, Plugin } from 'vite'

export function parseOriginTrialTokens(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => /^[A-Za-z0-9+/=]+$/.test(token))
}

export function createOriginTrialPlugin(tokens: readonly string[]): Plugin {
  const tags: HtmlTagDescriptor[] = tokens.map((token) => ({
    tag: 'meta',
    attrs: { 'http-equiv': 'origin-trial', content: token },
    injectTo: 'head',
  }))
  return {
    name: 'scormite-origin-trial',
    transformIndexHtml: () => tags,
  }
}
