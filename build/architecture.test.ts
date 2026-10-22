/**
 * The architecture diagram is generated from the code. These tests keep the
 * committed docs/architecture.svg in step with it, and check the rules the
 * diagram shows.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  analyzeArchitecture,
  boundaryViolations,
  importSpecifiers,
  importTarget,
  moduleOf,
  renderArchitectureSvg,
  renderDocsDiagram,
} from './architecture.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('module resolution', () => {
  it('maps source paths to their layer', () => {
    expect(moduleOf('main.tsx')).toBe('app')
    expect(moduleOf('app/course/CourseSession.ts')).toBe('app')
    expect(moduleOf('features/runtime/adapter/Scorm12Adapter.ts')).toBe('features/runtime')
    expect(moduleOf('shared/types/index.ts')).toBe('shared')
    expect(moduleOf('components/ui/button.tsx')).toBe('components')
    expect(moduleOf('index.css')).toBeNull()
  })

  it('resolves alias, relative, and package imports', () => {
    expect(importTarget('app/App.tsx', '@/features/player')).toBe('features/player')
    expect(importTarget('features/player/components/A.tsx', '../../../shared/lib/utils')).toBe('shared')
    expect(importTarget('features/runtime/x.ts', 'scorm-again/scorm12')).toBe('npm:scorm-again')
    expect(importTarget('app/App.tsx', 'react')).toBeNull()
  })

  it('reads static, re-export, side-effect, and dynamic imports, ignoring comments', () => {
    const source = [
      "import { a } from '@/shared/lib'",
      "import type { B } from './b'",
      "export { c } from '../c'",
      "import '@/index.css'",
      "const d = await import('@/app/course/openPackage')",
      "// import { e } from '@/features/e'",
      "/* import { f } from '@/features/f' */",
    ].join('\n')
    expect(importSpecifiers(source)).toEqual(['@/shared/lib', './b', '../c', '@/index.css', '@/app/course/openPackage'])
  })
})

describe('the codebase', () => {
  const graph = analyzeArchitecture(root)

  it('has no imports from one feature into another', () => {
    expect(boundaryViolations(graph)).toEqual([])
  })

  it('reaches scorm-again only through the runtime feature', () => {
    expect(graph.edges.filter((e) => e.to === 'npm:scorm-again').map((e) => e.from)).toEqual(['features/runtime'])
  })

  it('docs/architecture.svg matches the code (run `pnpm run diagram` to update it)', () => {
    const committed = readFileSync(path.join(root, 'docs', 'architecture.svg'), 'utf8').replace(/\r\n/g, '\n')
    expect(committed).toBe(renderDocsDiagram(root))
  })
})

describe('renderArchitectureSvg', () => {
  const graph = {
    modules: [
      { id: 'app', kind: 'app' as const, files: 3, lines: 120 },
      { id: 'features/a', kind: 'feature' as const, files: 2, lines: 40 },
      { id: 'features/b', kind: 'feature' as const, files: 1, lines: 10 },
      { id: 'shared', kind: 'shared' as const, files: 1, lines: 5 },
    ],
    edges: [
      { from: 'app', to: 'features/a', imports: 1 },
      { from: 'features/a', to: 'features/b', imports: 1 },
      { from: 'features/a', to: 'shared', imports: 2 },
    ],
  }

  it('shows file and line counts only when asked', () => {
    expect(renderArchitectureSvg(graph, { metrics: true, colors: {} })).toContain('2 files · 40 lines')
    expect(renderArchitectureSvg(graph, { metrics: false, colors: {} })).not.toContain('lines')
  })

  it('calls out a boundary violation and describes the graph for screen readers', () => {
    const svg = renderArchitectureSvg(graph, { metrics: false, colors: {} })
    expect(svg).toContain('Boundary violations (a feature importing another): a → b')
    expect(svg).toContain('app imports 1 of 2 features')
    expect(svg).toMatch(/<desc id="arch-desc">2 features: a, b\./)
  })
})
