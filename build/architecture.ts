/**
 * The architecture diagram, drawn from the code: every module under `src/`
 * (the app layer, each feature, shared, components), the runtime package, and
 * the imports between them. Nothing is hand-maintained — add a feature or an
 * import and the diagram changes with it.
 *
 *  - `docs/architecture.svg` (structure only) is committed; a unit test fails
 *    when it no longer matches the code. Regenerate it with `pnpm run diagram`.
 *  - The About page draws it at build time with live file and line counts.
 *
 * Node built-ins only, so `node build/architecture.ts [out.svg]` runs it.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ModuleKind = 'app' | 'feature' | 'shared' | 'components' | 'package'

export interface ArchitectureModule {
  id: string
  kind: ModuleKind
  files: number
  lines: number
}

export interface ArchitectureEdge {
  from: string
  to: string
  imports: number
}

export interface ArchitectureGraph {
  modules: ArchitectureModule[]
  edges: ArchitectureEdge[]
}

/** npm packages drawn as modules: the runtime the architecture is built around. */
const DRAWN_PACKAGES = ['scorm-again']

const IMPORT =
  /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

/** The module a `src/`-relative path belongs to, or null for files outside the layers. */
export function moduleOf(srcPath: string): string | null {
  const [top, second] = srcPath.split('/')
  if (top === 'main.tsx' || top === 'app') return 'app'
  if (top === 'features' && second) return `features/${second}`
  if (top === 'shared' || top === 'components') return top
  return null
}

function kindOf(id: string): ModuleKind {
  if (id.startsWith('features/')) return 'feature'
  if (id.startsWith('npm:')) return 'package'
  return id as ModuleKind
}

/** The module an import specifier in `fromPath` points at, or null when it is not drawn. */
export function importTarget(fromPath: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return moduleOf(specifier.slice(2))
  if (specifier.startsWith('.'))
    return moduleOf(path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier)))
  const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
  return DRAWN_PACKAGES.includes(name) ? `npm:${name}` : null
}

export function importSpecifiers(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return [...code.matchAll(IMPORT)].map((match) => (match[1] ?? match[2] ?? match[3])!)
}

/** Production source files under `src/`, as `src/`-relative POSIX paths (tests and setup excluded). */
function sourceFiles(srcDir: string): string[] {
  return readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(file))
    .filter((file) => !file.split('/').some((part) => part === 'test' || part === 'tests'))
    .sort()
}

export function analyzeArchitecture(root: string): ArchitectureGraph {
  const srcDir = path.join(root, 'src')
  const modules = new Map<string, ArchitectureModule>()
  const edges = new Map<string, ArchitectureEdge>()
  const moduleFor = (id: string) => {
    let entry = modules.get(id)
    if (!entry) modules.set(id, (entry = { id, kind: kindOf(id), files: 0, lines: 0 }))
    return entry
  }

  for (const file of sourceFiles(srcDir)) {
    const from = moduleOf(file)
    if (!from) continue
    const source = readFileSync(path.join(srcDir, file), 'utf8')
    const module = moduleFor(from)
    module.files += 1
    module.lines += source.split('\n').length
    for (const specifier of importSpecifiers(source)) {
      const to = importTarget(file, specifier)
      if (!to || to === from) continue
      moduleFor(to)
      const key = `${from}→${to}`
      const edge = edges.get(key) ?? { from, to, imports: 0 }
      edge.imports += 1
      edges.set(key, edge)
    }
  }

  const order: ModuleKind[] = ['app', 'feature', 'shared', 'components', 'package']
  return {
    modules: [...modules.values()].sort(
      (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id),
    ),
    edges: [...edges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
  }
}

/** Imports from one feature into another — what the architecture forbids. */
export function boundaryViolations(graph: ArchitectureGraph): ArchitectureEdge[] {
  return graph.edges.filter((edge) => edge.from.startsWith('features/') && edge.to.startsWith('features/'))
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

/** Theme colours from `src/index.css`, so the diagram follows the app's palette. */
export function themeColors(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{3,8})/gi)].map((m) => [m[1]!, m[2]!]))
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const count = (n: number, noun: string) => `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`

const LAYER_NOTES: Record<ModuleKind, string> = {
  app: 'Shell, modes, layout, course player — the only layer that joins features',
  feature: '',
  shared: 'Types, config, and utilities shared by every layer',
  components: 'UI primitives (shadcn/ui shape)',
  package: 'npm runtime, never modified',
}

export interface DiagramOptions {
  /** Show file and line counts (the About page); off for the committed docs diagram. */
  metrics: boolean
  colors: Record<string, string>
}

export function renderArchitectureSvg(graph: ArchitectureGraph, options: DiagramOptions): string {
  const c = {
    bg: options.colors['surface-950'] ?? '#0b0d10',
    box: options.colors['surface-900'] ?? '#101317',
    border: options.colors['border-subtle'] ?? '#262b33',
    accent: options.colors['accent'] ?? '#4da3ff',
    success: options.colors['success'] ?? '#3fb950',
    danger: options.colors['danger'] ?? '#f85149',
    muted: options.colors['slate-500'] ?? '#7f93ab',
    text: '#e2e8f0',
  }
  const width = 960
  const pad = 24
  const gap = 12
  const inner = width - pad * 2
  const out: string[] = []
  const text = (x: number, y: number, value: string, attrs = '') =>
    out.push(`<text x="${x}" y="${y}" ${attrs}>${escapeXml(value)}</text>`)
  const rect = (x: number, y: number, w: number, h: number, stroke: string) =>
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c.box}" stroke="${stroke}" />`)

  const byId = new Map(graph.modules.map((m) => [m.id, m]))
  const importers = (id: string) => graph.edges.filter((e) => e.to === id).map((e) => e.from)
  const targets = (id: string) => graph.edges.filter((e) => e.from === id).map((e) => e.to)
  const violations = boundaryViolations(graph)
  const violating = new Set(violations.flatMap((e) => [e.from, e.to]))
  const metrics = (m: ArchitectureModule) =>
    options.metrics ? `${count(m.files, 'file')} · ${count(m.lines, 'line')}` : ''
  const name = (id: string) => id.replace(/^features\//, '').replace(/^npm:/, '')
  const usedBy = (id: string) => {
    const from = importers(id)
    const features = from.filter((f) => f.startsWith('features/')).length
    const parts = [...(from.includes('app') ? ['app'] : []), ...(features ? [count(features, 'feature')] : [])]
    return parts.length ? `used by ${parts.join(' + ')}` : 'unused'
  }

  let y = pad
  text(pad, y + 14, 'SCORMite architecture', `font-size="15" font-weight="600" fill="${c.text}"`)
  text(width - pad, y + 14, 'generated from src/ imports', `font-size="11" fill="${c.muted}" text-anchor="end"`)
  y += 34

  // Layer 1 — app
  const app = byId.get('app')
  if (app) {
    rect(pad, y, inner, 52, c.accent)
    text(pad + 14, y + 22, 'app', `font-size="14" font-weight="600" fill="${c.text}"`)
    text(pad + 14, y + 40, LAYER_NOTES.app, `font-size="11" fill="${c.muted}"`)
    if (options.metrics)
      text(width - pad - 14, y + 22, metrics(app), `font-size="11" fill="${c.muted}" text-anchor="end"`)
    y += 52
  }

  const features = graph.modules.filter((m) => m.kind === 'feature')
  const arrow = (label: string) => {
    const x = width / 2
    out.push(
      `<path d="M${x} ${y + 4} V${y + 26}" stroke="${c.muted}" stroke-width="1.5" />`,
      `<path d="M${x - 5} ${y + 20} L${x} ${y + 27} L${x + 5} ${y + 20}" fill="none" stroke="${c.muted}" stroke-width="1.5" />`,
    )
    text(x + 12, y + 20, label, `font-size="11" fill="${c.muted}"`)
    y += 32
  }
  const appTargets = new Set(app ? targets('app') : [])
  arrow(`app imports ${features.filter((f) => appTargets.has(f.id)).length} of ${features.length} features`)

  // Layer 2 — features
  const cols = 4
  const boxW = (inner - gap * (cols - 1)) / cols
  const boxH = options.metrics ? 72 : 56
  features.forEach((feature, i) => {
    const x = pad + (i % cols) * (boxW + gap)
    const top = y + Math.floor(i / cols) * (boxH + gap)
    rect(x, top, boxW, boxH, violating.has(feature.id) ? c.danger : c.border)
    text(x + 12, top + 20, name(feature.id), `font-size="13" font-weight="600" fill="${c.text}"`)
    const deps = targets(feature.id)
      .filter((t) => !t.startsWith('features/'))
      .map(name)
    let px = x + 12
    for (const dep of deps) {
      const w = dep.length * 6.2 + 12
      const color = dep === 'scorm-again' ? c.success : c.accent
      out.push(
        `<rect x="${px}" y="${top + 30}" width="${w}" height="16" rx="8" fill="none" stroke="${color}" stroke-opacity="0.6" />`,
      )
      text(px + w / 2, top + 42, dep, `font-size="10" fill="${color}" text-anchor="middle"`)
      px += w + 6
    }
    if (options.metrics) text(x + 12, top + 62, metrics(feature), `font-size="10" fill="${c.muted}"`)
  })
  y += Math.ceil(features.length / cols) * (boxH + gap) - gap

  arrow('features import only shared, components, and their own files')

  // Layer 3 — shared, components, and the runtime package
  const bottom = graph.modules.filter((m) => m.kind === 'shared' || m.kind === 'components' || m.kind === 'package')
  const bottomW = (inner - gap * (bottom.length - 1)) / Math.max(bottom.length, 1)
  const bottomH = options.metrics ? 86 : 70
  bottom.forEach((module, i) => {
    const x = pad + i * (bottomW + gap)
    rect(x, y, bottomW, bottomH, module.kind === 'package' ? c.success : c.border)
    text(x + 12, y + 20, name(module.id), `font-size="13" font-weight="600" fill="${c.text}"`)
    text(x + 12, y + 38, LAYER_NOTES[module.kind], `font-size="10" fill="${c.muted}"`)
    const users =
      module.kind === 'package'
        ? `used only by ${importers(module.id).map(name).join(', ') || 'nothing'}`
        : usedBy(module.id)
    text(x + 12, y + 56, users, `font-size="10" fill="${c.muted}"`)
    if (options.metrics && module.kind !== 'package')
      text(x + 12, y + 74, metrics(module), `font-size="10" fill="${c.muted}"`)
  })
  y += bottomH

  if (violations.length > 0) {
    y += 22
    const list = violations.map((e) => `${name(e.from)} → ${name(e.to)}`).join(', ')
    text(pad, y, `Boundary violations (a feature importing another): ${list}`, `font-size="11" fill="${c.danger}"`)
  }
  y += pad

  const description = [
    `${features.length} features: ${features.map((f) => name(f.id)).join(', ')}.`,
    'app joins features; features use only shared and components;',
    `scorm-again is used only by ${importers('npm:scorm-again').map(name).join(', ') || 'nothing'}.`,
    violations.length ? `${violations.length} boundary violation(s).` : 'No boundary violations.',
  ].join(' ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y}" width="${width}" height="${y}" role="img" aria-labelledby="arch-title arch-desc" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">`,
    `<title id="arch-title">SCORMite architecture</title>`,
    `<desc id="arch-desc">${escapeXml(description)}</desc>`,
    `<rect width="${width}" height="${y}" rx="8" fill="${c.bg}" />`,
    ...out,
    '</svg>',
    '',
  ].join('\n')
}

/** The committed docs diagram: structure only, so it changes only when the architecture does. */
export function renderDocsDiagram(root: string): string {
  const colors = themeColors(readFileSync(path.join(root, 'src', 'index.css'), 'utf8'))
  return renderArchitectureSvg(analyzeArchitecture(root), { metrics: false, colors })
}

// `node build/architecture.ts [out]` (pnpm run diagram) rewrites the committed diagram.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const outFile = path.resolve(root, process.argv[2] ?? 'docs/architecture.svg')
  writeFileSync(outFile, renderDocsDiagram(root))
  console.log(`Wrote ${path.relative(root, outFile)}`)
}
