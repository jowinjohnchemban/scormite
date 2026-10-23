/**
 * Bounded reads stop at the limit even when the response does not declare
 * its length.
 */

import { describe, expect, it } from 'vitest'
import { readBounded } from './readBounded'

function streamed(chunks: number[]): Response {
  let pulled = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = chunks[pulled++]
      if (size === undefined) controller.close()
      else controller.enqueue(new Uint8Array(size))
    },
  })
  return new Response(body)
}

describe('readBounded', () => {
  it('reads a body within the limit', async () => {
    expect(new TextDecoder().decode((await readBounded(new Response('abc'), 3))!)).toBe('abc')
    expect((await readBounded(streamed([2, 2]), 4))?.length).toBe(4)
  })

  it('stops at the limit without a content-length', async () => {
    expect(await readBounded(streamed([3, 3, 3]), 5)).toBeNull()
  })

  it('refuses a declared length over the limit without reading', async () => {
    expect(await readBounded(new Response('abcdef', { headers: { 'content-length': '6' } }), 5)).toBeNull()
  })
})
