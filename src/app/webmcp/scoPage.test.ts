/**
 * Reading the running SCO's page and operating it like a learner.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { interactWithSco, readScoPage } from './scoPage'

let doc: Document

beforeEach(() => {
  doc = document.implementation.createHTMLDocument('Quiz 1')
  doc.documentElement.setAttribute('lang', 'en')
  doc.body.innerHTML = `
    <h1>Quiz</h1>
    <p>Answer   both questions.</p>
    <p hidden>Secret answer key</p>
    <script>var answers = 1</script>
    <img src="logo.png" alt="Company logo"><img src="chart.png">
    <label for="name">Your name</label><input id="name" type="text">
    <label><input id="agree" type="checkbox"> I agree</label>
    <select id="capital"><option value="">Choose</option><option value="paris">Paris</option></select>
    <button id="submit">Submit</button>
    <button id="icon"></button>
    <button hidden>Hidden button</button>
  `
})

describe('readScoPage', () => {
  it('returns what the learner sees, not hidden content or scripts', () => {
    const page = readScoPage(doc)
    expect(page.title).toBe('Quiz 1')
    expect(page.lang).toBe('en')
    expect(page.text).toContain('Answer both questions.')
    expect(page.text).not.toContain('Secret answer key')
    expect(page.text).not.toContain('var answers')
    expect(page.headings).toEqual([{ level: 1, text: 'Quiz' }])
    expect(page.images).toEqual([
      { src: 'logo.png', alt: 'Company logo' },
      { src: 'chart.png', alt: null },
    ])
  })

  it('lists visible controls with names and refs that stay stable across reads', () => {
    const first = readScoPage(doc).controls
    expect(first.map((c) => [c.tag, c.name])).toEqual([
      ['input', 'Your name'],
      ['input', 'I agree'],
      ['select', ''],
      ['button', 'Submit'],
      ['button', ''],
    ])
    expect(first[2]?.options).toEqual(['Choose', 'Paris'])
    expect(readScoPage(doc).controls.map((c) => c.ref)).toEqual(first.map((c) => c.ref))
  })

  it('reports accessibility problems', () => {
    const page = readScoPage(doc)
    expect(page.accessibility).toContain('1 image(s) have no alt attribute.')
    // The unlabelled select and the empty icon button.
    expect(page.accessibility.some((p) => p.startsWith('2 control(s) have no accessible name'))).toBe(true)
  })

  it('truncates long text', () => {
    const page = readScoPage(doc, 10)
    expect(page.text).toHaveLength(10)
    expect(page.truncated).toBe(true)
  })
})

describe('interactWithSco', () => {
  const refOf = (id: string) => doc.getElementById(id)?.getAttribute('data-scormite-ref') ?? ''

  beforeEach(() => {
    readScoPage(doc)
  })

  it('clicks, types, selects, and checks', () => {
    const clicked = vi.fn()
    doc.getElementById('submit')?.addEventListener('click', clicked)
    const changed = vi.fn()
    doc.getElementById('name')?.addEventListener('input', changed)

    expect(interactWithSco(doc, refOf('submit'), 'click')).toBeNull()
    expect(clicked).toHaveBeenCalled()

    expect(interactWithSco(doc, refOf('name'), 'type', 'Ada')).toBeNull()
    expect((doc.getElementById('name') as HTMLInputElement).value).toBe('Ada')
    expect(changed).toHaveBeenCalled()

    expect(interactWithSco(doc, refOf('capital'), 'select', 'Paris')).toBeNull()
    expect((doc.getElementById('capital') as HTMLSelectElement).value).toBe('paris')

    expect(interactWithSco(doc, refOf('agree'), 'check')).toBeNull()
    expect((doc.getElementById('agree') as HTMLInputElement).checked).toBe(true)
    expect(interactWithSco(doc, refOf('agree'), 'check')).toBeNull()
    expect((doc.getElementById('agree') as HTMLInputElement).checked).toBe(true)
  })

  it('explains what went wrong', () => {
    expect(interactWithSco(doc, 'e999', 'click')).toMatch(/read_sco_page again/)
    expect(interactWithSco(doc, refOf('submit'), 'type', 'x')).toMatch(/not a text field/)
    expect(interactWithSco(doc, refOf('capital'), 'select', 'Rome')).toMatch(/no option "Rome"/)
  })
})
