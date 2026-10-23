/**
 * WebMCP tools for checking a package is safe to run: a rule-based security
 * scan of every file, and SHA-256 hashes to check files against an antivirus
 * engine or a malware database.
 */

import { usePackageStore } from '@/features/package-loader'
import { packageLaunchUrl } from '@/features/player'
import { useValidationStore } from '@/features/validation'
import type { ModelContextTool } from './modelContext'
import { SCANNED_TEXT, scanHead, scanPath, scanText, sha256, type SecurityFinding } from './securityScan'
import type { ToolHost } from './tools'

const NO_PACKAGE = { error: 'No package is open. Ask the user to drop a SCORM .zip on the SCORMite page.' }
/** Larger text files are only checked by name and first bytes. */
const MAX_TEXT_BYTES = 5_000_000
/** Larger files are not hashed. */
const MAX_HASH_BYTES = 200_000_000
const MAX_FINDINGS = 500

const string = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** The first bytes of a response, without reading the rest. */
async function head(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array(await response.arrayBuffer()).subarray(0, 16)
  try {
    const { value } = await reader.read()
    return value ?? new Uint8Array()
  } finally {
    void reader.cancel().catch(() => undefined)
  }
}

export function createSecurityTools(host: ToolHost): ModelContextTool[] {
  return [
    {
      name: 'scan_package_security',
      title: 'Scan the package for malware and abuse',
      description:
        "An offline, rule-based security scan of every file in the package: programs and installers (also disguised as other files), macro documents, crypto-miners, obfuscated or packed scripts, ActiveX scripting, hidden external frames, password fields and forms that send data elsewhere, redirects and breaking out of the LMS window, and service workers that would run on the LMS's origin. It is not an antivirus engine: for a malware verdict, check the files' get_file_hashes against one. With record: true, the findings are also added to the Validation panel and the QA report.",
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Only files whose path starts with this' },
          record: { type: 'boolean', description: 'Also record the findings as review issues' },
        },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, { signal }) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const prefix = string(input['prefix']) ?? ''
        const findings: SecurityFinding[] = []
        let scanned = 0
        for (const path of usePackageStore.getState().filePaths) {
          if (!path.startsWith(prefix)) continue
          findings.push(...scanPath(path))
          const response = await fetch(packageLaunchUrl(session.pkg.id, path), { signal })
          if (!response.ok) continue
          scanned++
          const length = Number(response.headers.get('content-length'))
          if (SCANNED_TEXT.test(path) && !(length > MAX_TEXT_BYTES)) {
            const bytes = new Uint8Array(await response.arrayBuffer())
            findings.push(...scanHead(path, bytes))
            if (bytes.length <= MAX_TEXT_BYTES) findings.push(...scanText(path, new TextDecoder().decode(bytes)))
          } else {
            findings.push(...scanHead(path, await head(response)))
          }
        }
        if (input['record'] === true) {
          const validation = useValidationStore.getState()
          for (const finding of findings) {
            validation.addIssue({
              id: `review-${crypto.randomUUID()}`,
              severity: finding.severity === 'info' ? 'suggestion' : finding.severity,
              source: 'review',
              message: finding.message,
              ruleId: `review.security.${finding.rule}`,
              location: finding.line ? `${finding.file}:${finding.line}` : finding.file,
            })
          }
        }
        const summary = { error: 0, warning: 0, info: 0 }
        for (const finding of findings) summary[finding.severity]++
        return {
          scannedFiles: scanned,
          summary,
          findings: findings.slice(0, MAX_FINDINGS),
          ...(findings.length > MAX_FINDINGS ? { truncated: true } : {}),
          ...(input['record'] === true ? { recorded: findings.length } : {}),
          note: 'A rule-based check, not an antivirus verdict. No findings does not prove a package is safe; check the hashes from get_file_hashes with an antivirus engine (such as ClamAV) or a malware database.',
        }
      },
    },
    {
      name: 'get_file_hashes',
      title: 'Hash the package files',
      description:
        'SHA-256 hash and size of package files, to check them against an antivirus engine or a malware database (such as ClamAV or VirusTotal), or to compare two versions of a package.',
      inputSchema: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'These files (default: all)' },
          prefix: { type: 'string', description: 'Only files whose path starts with this' },
          maxFiles: { type: 'integer', minimum: 1, maximum: 2000, description: 'Default 200' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input, { signal }) => {
        const session = host.session()
        if (!session.pkg) return NO_PACKAGE
        const all = usePackageStore.getState().filePaths
        const requested = Array.isArray(input['paths'])
          ? input['paths'].filter((path): path is string => typeof path === 'string')
          : null
        const prefix = string(input['prefix']) ?? ''
        const max = Math.min(Math.max(Math.trunc(Number(input['maxFiles'])) || 200, 1), 2000)
        const selected = (requested ?? all).filter((path) => path.startsWith(prefix))
        const files: { path: string; size?: number; sha256?: string; error?: string }[] = []
        for (const path of selected.slice(0, max)) {
          if (!all.includes(path)) {
            files.push({ path, error: 'Not in the package.' })
            continue
          }
          const response = await fetch(packageLaunchUrl(session.pkg.id, path), { signal })
          if (!response.ok) {
            files.push({ path, error: `Could not be read (${response.status}).` })
            continue
          }
          if (Number(response.headers.get('content-length')) > MAX_HASH_BYTES) {
            void response.body?.cancel()
            files.push({ path, error: 'Too large to hash here.' })
            continue
          }
          const bytes = await response.arrayBuffer()
          files.push({ path, size: bytes.byteLength, sha256: await sha256(bytes) })
        }
        return { files, ...(selected.length > max ? { truncated: true, totalFiles: selected.length } : {}) }
      },
    },
  ]
}
