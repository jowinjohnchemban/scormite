/**
 * Reading and operating the running SCO's page, so an agent can review its
 * content and take the course like a learner. The SCO runs in the player
 * iframe on SCORMite's origin, so its document is reachable directly.
 *
 * Interactive elements get a `data-scormite-ref` attribute when the page is
 * read; `interactWithSco` finds them by that ref. Everything read here is the
 * package's own content and is returned to agents as untrusted.
 */

const PLAYER = 'iframe[title="SCORM Package"]'
const REF = 'data-scormite-ref'
const CONTROLS =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="option"], [role="tab"], [role="menuitem"], [role="slider"], [onclick], [tabindex]:not([tabindex="-1"])'
const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])

/** The running SCO's document, or null when nothing is running. */
export function scoDocument(doc: Document = document): Document | null {
  const frame = doc.querySelector<HTMLIFrameElement>(PLAYER)
  try {
    return frame?.contentDocument ?? null
  } catch {
    return null
  }
}

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/**
 * Whether an element is a given HTML element. `instanceof HTMLInputElement`
 * is false for the SCO's elements: they belong to the iframe's window, whose
 * constructors are not SCORMite's.
 */
function isElement<K extends keyof HTMLElementTagNameMap>(
  element: Element,
  tag: K,
): element is HTMLElementTagNameMap[K] {
  return element.localName === tag && element.namespaceURI === 'http://www.w3.org/1999/xhtml'
}

function isHidden(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true
    const style = node.ownerDocument.defaultView?.getComputedStyle(node)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true
  }
  return false
}

/** The name a screen reader would announce, approximately. */
export function accessibleName(element: Element): string {
  const doc = element.ownerDocument
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = clean(
      labelledBy
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent)
        .join(' '),
    )
    if (text) return text
  }
  const aria = clean(element.getAttribute('aria-label'))
  if (aria) return aria
  if (element.id) {
    const label = clean(doc.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent)
    if (label) return label
  }
  const wrapping = clean(element.closest('label')?.textContent)
  if (wrapping) return wrapping
  if (isElement(element, 'img')) return clean(element.alt)
  if (isElement(element, 'input') && ['button', 'submit', 'reset'].includes(element.type)) {
    return clean(element.value)
  }
  // A form field's content (a select's options, a field's value) is not its name.
  const isField = isElement(element, 'select') || isElement(element, 'textarea') || isElement(element, 'input')
  return (
    (isField ? '' : clean(element.textContent)) ||
    clean(element.getAttribute('title')) ||
    clean(element.getAttribute('placeholder'))
  )
}

export interface ScoControl {
  ref: string
  tag: string
  role?: string
  type?: string
  name: string
  value?: string
  checked?: boolean
  disabled?: boolean
  options?: string[]
}

export interface ScoPage {
  path: string
  title: string
  lang: string
  text: string
  truncated: boolean
  headings: { level: number; text: string }[]
  images: { src: string; alt: string | null }[]
  controls: ScoControl[]
  /** Nested frames; their content is not included. */
  frames: number
  accessibility: string[]
}

function visibleText(body: HTMLElement): string {
  const parts: string[] = []
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (!parent || SKIP_TEXT.has(parent.tagName) || isHidden(parent)) continue
    const text = clean(node.textContent)
    if (text) parts.push(text)
  }
  return parts.join(' ')
}

/** The running page's content, interactive controls (with refs), and accessibility findings. */
export function readScoPage(doc: Document, maxChars = 8000): ScoPage {
  const body = doc.body
  const allText = body ? visibleText(body) : ''
  let next = 1
  for (const element of doc.querySelectorAll(`[${REF}]`)) {
    next = Math.max(next, Number(element.getAttribute(REF)?.slice(1)) + 1 || next)
  }

  const controls: ScoControl[] = []
  for (const element of doc.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (isHidden(element)) continue
    let ref = element.getAttribute(REF)
    if (!ref) {
      ref = `e${next++}`
      element.setAttribute(REF, ref)
    }
    const control: ScoControl = { ref, tag: element.tagName.toLowerCase(), name: accessibleName(element) }
    const role = element.getAttribute('role')
    if (role) control.role = role
    if (isElement(element, 'input')) {
      control.type = element.type
      if (element.type === 'checkbox' || element.type === 'radio') control.checked = element.checked
      else control.value = element.value
    } else if (isElement(element, 'textarea')) {
      control.value = element.value
    } else if (isElement(element, 'select')) {
      control.value = element.value
      control.options = [...element.options].map((option) => clean(option.textContent) || option.value)
    } else if (element.getAttribute('aria-checked') !== null) {
      control.checked = element.getAttribute('aria-checked') === 'true'
    }
    if ((element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true') {
      control.disabled = true
    }
    controls.push(control)
  }

  const images = [...doc.querySelectorAll('img')]
    .filter((img) => !isHidden(img))
    .map((img) => ({ src: img.getAttribute('src') ?? '', alt: img.getAttribute('alt') }))

  const accessibility: string[] = []
  if (!clean(doc.documentElement.getAttribute('lang'))) accessibility.push('The page has no lang attribute.')
  if (!clean(doc.title)) accessibility.push('The page has no title.')
  const unnamedImages = images.filter((img) => img.alt === null).length
  if (unnamedImages) accessibility.push(`${unnamedImages} image(s) have no alt attribute.`)
  const unnamedControls = controls.filter((control) => !control.name)
  if (unnamedControls.length) {
    accessibility.push(
      `${unnamedControls.length} control(s) have no accessible name: ${unnamedControls.map((c) => c.ref).join(', ')}.`,
    )
  }

  const path = decodeURIComponent(doc.location?.pathname ?? '').replace(/^\/scorm-files\/[^/]+\//, '')
  return {
    path,
    title: clean(doc.title),
    lang: clean(doc.documentElement.getAttribute('lang')),
    text: allText.slice(0, maxChars),
    truncated: allText.length > maxChars,
    headings: [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((h) => !isHidden(h))
      .map((h) => ({ level: Number(h.tagName[1]), text: clean(h.textContent) })),
    images,
    controls,
    frames: doc.querySelectorAll('iframe, frame').length,
    accessibility,
  }
}

export type ScoAction = 'click' | 'type' | 'select' | 'check' | 'uncheck'

/** Sets a form value so frameworks that track the native setter (React and others) see it. */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = Object.getPrototypeOf(element) as object
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
}

/** Operate a control found by `readScoPage`. Returns an error message, or null when done. */
export function interactWithSco(doc: Document, ref: string, action: ScoAction, value = ''): string | null {
  const element = doc.querySelector<HTMLElement>(`[${REF}="${CSS.escape(ref)}"]`)
  if (!element) return `No control "${ref}" on the current page. Call read_sco_page again — the page may have changed.`
  if ((element as HTMLButtonElement).disabled) return `Control "${ref}" is disabled.`
  // An event from the SCO's own window, as its scripts expect.
  const EventType = element.ownerDocument.defaultView?.Event ?? Event
  const fire = (type: string) => element.dispatchEvent(new EventType(type, { bubbles: true }))

  switch (action) {
    case 'click':
      element.click()
      return null
    case 'type':
      if (!(isElement(element, 'input') || isElement(element, 'textarea'))) {
        return `Control "${ref}" is not a text field.`
      }
      element.focus()
      setNativeValue(element, value)
      fire('input')
      fire('change')
      return null
    case 'select': {
      if (!isElement(element, 'select')) return `Control "${ref}" is not a select list.`
      const option = [...element.options].find((o) => o.value === value || clean(o.textContent) === clean(value))
      if (!option) return `Control "${ref}" has no option "${value}".`
      element.value = option.value
      fire('input')
      fire('change')
      return null
    }
    case 'check':
    case 'uncheck': {
      const want = action === 'check'
      const current = isElement(element, 'input') ? element.checked : element.getAttribute('aria-checked') === 'true'
      if (current !== want) element.click()
      return null
    }
    default:
      return 'action must be one of click, type, select, check, uncheck.'
  }
}
