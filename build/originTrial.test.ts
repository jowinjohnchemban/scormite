import { describe, expect, it } from 'vitest'
import { createOriginTrialPlugin, parseOriginTrialTokens } from './originTrial.js'

describe('origin-trial tokens', () => {
  it('reads comma-separated tokens and drops anything that is not one', () => {
    expect(parseOriginTrialTokens(' AbC123+/= , bad token!,, Zz9= ')).toEqual(['AbC123+/=', 'Zz9='])
    expect(parseOriginTrialTokens(undefined)).toEqual([])
  })

  it('adds one origin-trial meta tag per token', () => {
    const plugin = createOriginTrialPlugin(['AbC=', 'Zz9='])
    const transform = plugin.transformIndexHtml as () => unknown
    expect(transform()).toEqual([
      { tag: 'meta', attrs: { 'http-equiv': 'origin-trial', content: 'AbC=' }, injectTo: 'head' },
      { tag: 'meta', attrs: { 'http-equiv': 'origin-trial', content: 'Zz9=' }, injectTo: 'head' },
    ])
  })
})
