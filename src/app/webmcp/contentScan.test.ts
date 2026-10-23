/**
 * Reading package files for content review: page and caption text, file
 * references, how they resolve, and line search.
 */

import { describe, expect, it } from 'vitest'
import { captionText, cssReferences, htmlReferences, pageText, resolveReference, searchLines } from './contentScan'

describe('pageText', () => {
  it('keeps what a reader sees and drops scripts, styles, and hidden content', () => {
    const page = pageText(`<!doctype html><html lang="en-GB"><head><title> Lesson 1 </title>
      <style>p { color: red }</style></head><body><h1>Welcome</h1><p>Read   carefuly.</p>
      <p hidden>Answer key</p><script>var x = 'secret'</script>
      <img src="a.png" alt="A diagram"><img src="b.png" alt=""><img src="c.png"></body></html>`)
    expect(page).toEqual({ title: 'Lesson 1', lang: 'en-GB', text: 'Welcome Read carefuly.', imageAlts: ['A diagram'] })
  })
})

describe('captionText', () => {
  it('keeps the spoken text of WebVTT and SRT files', () => {
    expect(
      captionText('WEBVTT\n\n00:00.000 --> 00:02.000\n<v Narrator>Hello there.\n\n00:02.000 --> 00:04.000\nWelcome.'),
    ).toBe('Hello there. Welcome.')
    expect(
      captionText('1\n00:00:00,000 --> 00:00:02,000\nFirst line\n\n2\n00:00:02,000 --> 00:00:03,000\nSecond'),
    ).toBe('First line Second')
  })
})

describe('references', () => {
  it('finds src, href, srcset, poster, and CSS urls in HTML', () => {
    const refs =
      htmlReferences(`<html><head><link href="css/site.css"><style>body{background:url('img/bg.png')}</style></head>
      <body><img src="img/a.png" srcset="img/a@2x.png 2x, img/a@3x.png 3x"><video poster="v.jpg"></video>
      <div style="background-image: url(img/c.png)"></div><a href="#top">Top</a></body></html>`)
    expect(refs).toEqual(
      expect.arrayContaining([
        'css/site.css',
        'img/a.png',
        'img/a@2x.png',
        'img/a@3x.png',
        'v.jpg',
        'img/c.png',
        'img/bg.png',
        '#top',
      ]),
    )
  })

  it('finds url() and @import in CSS', () => {
    expect(
      cssReferences(`@import "base.css"; .a { background: url("../img/x.svg") } .b { src: url(f.woff2) }`),
    ).toEqual(['base.css', '../img/x.svg', 'f.woff2'])
  })

  it('resolves references to package paths or external URLs, and skips what is not a file', () => {
    expect(resolveReference('lessons/one/index.html', '../../img/a%20b.png?v=1')).toEqual({
      kind: 'package',
      path: 'img/a b.png',
    })
    expect(resolveReference('lessons/index.html', '/shared/x.js')).toEqual({ kind: 'package', path: 'shared/x.js' })
    expect(resolveReference('index.html', 'https://cdn.example.com/x.js')).toEqual({
      kind: 'external',
      url: 'https://cdn.example.com/x.js',
    })
    expect(resolveReference('index.html', '//cdn.example.com/y.js')).toEqual({
      kind: 'external',
      url: '//cdn.example.com/y.js',
    })
    for (const skipped of ['#top', 'data:image/png;base64,AA', 'javascript:void(0)', 'mailto:a@b.c', '${src}', '']) {
      expect(resolveReference('index.html', skipped)).toBeNull()
    }
  })
})

describe('searchLines', () => {
  it('returns matching lines with their numbers, up to the limit', () => {
    const text = 'Click Next.\nclick next again\nDone.\nCLICK NEXT'
    expect(searchLines('a.html', text, /click next/gi, 2)).toEqual([
      { file: 'a.html', line: 1, text: 'Click Next.' },
      { file: 'a.html', line: 2, text: 'click next again' },
    ])
  })
})
