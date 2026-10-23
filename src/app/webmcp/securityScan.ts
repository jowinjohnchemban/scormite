/**
 * A static security scan of a package's files: what a SCORM package should
 * never contain (programs, installers, macro documents), executables disguised
 * as other files, and script and markup patterns common in malicious or
 * abusive web content (crypto-miners, obfuscated eval, hidden external frames,
 * credential forms, breaking out of the player, hijacking the page's origin).
 *
 * It is a rule-based check, open and offline like the rest of SCORMite — not
 * an antivirus engine. Files' SHA-256 hashes can be checked against one.
 */

export type SecuritySeverity = 'error' | 'warning' | 'info'

export interface SecurityFinding {
  severity: SecuritySeverity
  rule: string
  file: string
  line?: number
  message: string
}

const EXECUTABLE =
  /\.(exe|dll|scr|com|pif|cpl|msi|msp|msix|appx|bat|cmd|ps1|psm1|vbs|vbe|jse|wsf|wsh|hta|lnk|reg|jar|apk|ipa|dmg|pkg|app|deb|rpm|sh|run|bin|elf|iso|img|vhd)$/i
const MACRO_DOCUMENT = /\.(docm|dotm|xlsm|xltm|xlam|pptm|potm|ppam|sldm)$/i
const ARCHIVE = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|cab)$/i
/** Files the scan reads as text. */
export const SCANNED_TEXT = /\.(html?|xhtml|js|mjs|cjs|svg|xml|json|css)$/i

/** Checks on the file's name alone. */
export function scanPath(path: string): SecurityFinding[] {
  const name = path.split('/').pop() ?? path
  if (EXECUTABLE.test(name)) {
    const disguised = /\.[a-z0-9]{2,4}\.[a-z0-9]+$/i.test(name)
    return [
      {
        severity: 'error',
        rule: 'executable-file',
        file: path,
        message: `A program or installer${disguised ? ' with a double extension' : ''} is in the package. A course never needs one; remove it.`,
      },
    ]
  }
  if (MACRO_DOCUMENT.test(name)) {
    return [
      {
        severity: 'warning',
        rule: 'macro-document',
        file: path,
        message: 'An Office document that can contain macros. Check it, or provide a macro-free version.',
      },
    ]
  }
  if (ARCHIVE.test(name)) {
    return [
      {
        severity: 'info',
        rule: 'nested-archive',
        file: path,
        message: 'An archive inside the package; its contents are not scanned.',
      },
    ]
  }
  return []
}

/** Checks on a file's first bytes: executables whatever their name. */
export function scanHead(path: string, head: Uint8Array): SecurityFinding[] {
  if (EXECUTABLE.test(path)) return [] // already reported by name
  const at = (i: number) => head[i] ?? -1
  const kind =
    at(0) === 0x4d && at(1) === 0x5a
      ? 'a Windows program (MZ)'
      : at(0) === 0x7f && at(1) === 0x45 && at(2) === 0x4c && at(3) === 0x46
        ? 'a Linux program (ELF)'
        : (at(0) === 0xcf || at(0) === 0xce) && at(1) === 0xfa && at(2) === 0xed && at(3) === 0xfe
          ? 'a macOS program (Mach-O)'
          : null
  if (!kind) return []
  return [
    {
      severity: 'error',
      rule: 'disguised-executable',
      file: path,
      message: `The file is ${kind} named as something else. Remove it.`,
    },
  ]
}

interface TextRule {
  rule: string
  severity: SecuritySeverity
  pattern: RegExp
  message: string
  /** Only in these files. */
  files?: RegExp
}

const TEXT_RULES: TextRule[] = [
  {
    rule: 'crypto-miner',
    severity: 'error',
    pattern:
      /coinhive|coin-hive|cryptonight|cryptoloot|crypto-loot|coinimp|webminepool|jsecoin|minero\.cc|deepminer|stratum\+tcp|CoinHive\.Anonymous/i,
    message: 'A browser crypto-miner. Remove it.',
  },
  {
    rule: 'windows-scripting',
    severity: 'error',
    pattern: /ActiveXObject\s*\(\s*['"](WScript\.Shell|Shell\.Application|Scripting\.FileSystemObject|ADODB\.Stream)/i,
    message: 'Script that tries to run programs or write files on the computer through ActiveX.',
  },
  {
    rule: 'obfuscated-eval',
    severity: 'warning',
    pattern:
      /(\beval|\bFunction|setTimeout|setInterval)\s*\(\s*(window\.)?(atob|unescape|decodeURIComponent|escape|String\.fromCharCode)\s*\(/,
    message: 'Code decoded and run at run time — a common way to hide what a script does. Check what it decodes.',
  },
  {
    rule: 'packed-script',
    severity: 'warning',
    pattern: /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)/,
    message: 'A packed (p,a,c,k,e,d) script, which hides its code. Check the unpacked source.',
  },
  {
    rule: 'document-write-decoded',
    severity: 'warning',
    pattern: /document\.write(ln)?\s*\(\s*(unescape|atob|decodeURIComponent)\s*\(/,
    message: 'Markup written from decoded text, which hides what the page loads.',
  },
  {
    rule: 'service-worker',
    severity: 'warning',
    pattern: /serviceWorker\s*\.\s*register\s*\(/,
    message:
      'The package registers a service worker. In an LMS (and in SCORMite) it would run on the host’s origin and could intercept its requests.',
  },
  {
    rule: 'frame-breakout',
    severity: 'warning',
    pattern:
      /\b(top|parent|window\.top|window\.parent)\.location(\.href)?\s*=(?!=)|\btop\.location\.(replace|assign)\s*\(/,
    message: 'The course navigates the LMS window itself, taking the learner out of the LMS.',
  },
  {
    rule: 'clears-storage',
    severity: 'info',
    pattern: /localStorage\.clear\s*\(|indexedDB\.deleteDatabase\s*\(/,
    message: 'Clears the browser storage of the origin it runs on — in an LMS, the LMS’s own.',
  },
  {
    rule: 'file-download',
    severity: 'info',
    pattern: /msSaveOrOpenBlob|\.download\s*=\s*['"][^'"]+\.(exe|msi|bat|cmd|ps1|vbs|js|hta|jar|zip|iso)['"]/i,
    message: 'Script that saves a file to the learner’s computer. Check what it downloads.',
  },
  {
    rule: 'svg-script',
    severity: 'warning',
    pattern: /<script\b|\son[a-z]+\s*=\s*["']/i,
    files: /\.svg$/i,
    message: 'An SVG image with script in it; images should not run code.',
  },
]

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

const isExternal = (url: string | null) => url !== null && /^(https?:)?\/\//i.test(url.trim())

/** Checks on a text file's content. */
export function scanText(path: string, text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  for (const rule of TEXT_RULES) {
    if (rule.files && !rule.files.test(path)) continue
    const match = rule.pattern.exec(text)
    if (match) {
      findings.push({
        severity: rule.severity,
        rule: rule.rule,
        file: path,
        line: lineOf(text, match.index),
        message: rule.message,
      })
    }
  }
  if (/\.(x?html?)$/i.test(path)) findings.push(...scanMarkup(path, text))
  return findings
}

/** Checks that need the page's structure. */
function scanMarkup(path: string, html: string): SecurityFinding[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const findings: SecurityFinding[] = []
  const add = (severity: SecuritySeverity, rule: string, message: string) =>
    findings.push({ severity, rule, file: path, message })
  // A <base href> on another site sends every relative URL there too.
  const base = doc.querySelector('base[href]')?.getAttribute('href') ?? null
  const leaves = (url: string | null): url is string =>
    url !== null &&
    (isExternal(url) || (isExternal(base) && url.trim() !== '' && !/^(#|[a-z][a-z0-9+.-]*:)/i.test(url.trim())))
  const where = (url: string) => (isExternal(url) ? url : `${url} (on ${base ?? ''}, the page's base)`)

  for (const frame of doc.querySelectorAll('iframe, frame, object, embed')) {
    const source = frame.getAttribute('src') ?? frame.getAttribute('data')
    if (!leaves(source)) continue
    const style = (frame.getAttribute('style') ?? '').replace(/\s+/g, '').toLowerCase()
    const tiny = ['width', 'height'].some((size) => /^[01](px)?$/.test(frame.getAttribute(size)?.trim() ?? ''))
    if (
      tiny ||
      frame.hasAttribute('hidden') ||
      /display:none|visibility:hidden|width:[01]px|height:[01]px/.test(style)
    ) {
      add(
        'error',
        'hidden-external-frame',
        `A hidden frame loads ${where(source)} — a common sign of injected content.`,
      )
    }
  }
  if (doc.querySelector('input[type="password" i]')) {
    add(
      'warning',
      'password-field',
      'The page asks for a password. A course has no reason to; check it is not collecting credentials.',
    )
  }
  for (const form of doc.querySelectorAll('form')) {
    const action = form.getAttribute('action')
    if (leaves(action)) add('warning', 'external-form', `A form sends what the learner types to ${where(action)}.`)
  }
  // A submit button's formaction overrides its form's action.
  for (const button of doc.querySelectorAll('[formaction]')) {
    const action = button.getAttribute('formaction')
    if (leaves(action)) {
      add('warning', 'external-form', `A submit button sends what the learner types to ${where(action)}.`)
    }
  }
  for (const meta of doc.querySelectorAll('meta[http-equiv="refresh" i]')) {
    const target = /url\s*=\s*['"]?([^'";]+)/i.exec(meta.getAttribute('content') ?? '')?.[1] ?? null
    if (isExternal(target)) add('warning', 'external-redirect', `The page redirects to ${target}.`)
  }
  return findings
}

/** Lowercase hex SHA-256 of some bytes. */
export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
