/**
 * Content types the service worker serves package files with. Wrong types
 * break module scripts, stylesheets, WASM, and media, so the common
 * authoring-tool extensions are pinned here.
 */

import { describe, expect, it } from 'vitest'
import { mimeTypeFor } from '../services/PlayerBridgeService'

describe('mimeTypeFor', () => {
  it.each([
    ['index.html', 'text/html;charset=utf-8'],
    ['story_content/user.js', 'text/javascript'],
    ['lib/app.MJS', 'text/javascript'],
    ['html5/data/css/output.min.css', 'text/css'],
    ['mobile/captions.vtt', 'text/vtt'],
    ['engine.wasm', 'application/wasm'],
    ['media/clip.webm', 'video/webm'],
    ['media/voice.m4a', 'audio/mp4'],
    ['fonts/open-sans.woff2', 'font/woff2'],
    ['docs/handout.pdf', 'application/pdf'],
  ])('%s → %s', (path, expected) => {
    expect(mimeTypeFor(path)).toBe(expected)
  })

  it('falls back to octet-stream for unknown or missing extensions', () => {
    expect(mimeTypeFor('data.bin')).toBe('application/octet-stream')
    expect(mimeTypeFor('LICENSE')).toBe('application/octet-stream')
  })
})
