import { describe, expect, it } from 'vitest'
import { dependencyReport, updateType } from './dependencyReport.js'

describe('updateType', () => {
  it('names the part of the version that changes', () => {
    expect(updateType('6.0.3', '7.0.2')).toBe('major')
    expect(updateType('3.4.6', '3.5.0')).toBe('minor')
    expect(updateType('3.4.6', '3.4.7')).toBe('patch')
    expect(updateType('latest', '1.0.0')).toBe('other')
  })
})

describe('dependencyReport', () => {
  it('lists vulnerabilities first, then newer releases, majors first', () => {
    const report = dependencyReport(
      {
        zustand: { current: '5.0.15', latest: '5.0.16', dependencyType: 'dependencies' },
        typescript: { current: '6.0.3', latest: '7.0.2', dependencyType: 'devDependencies' },
        old: { current: '1.0.0', latest: '1.1.0', isDeprecated: true },
      },
      {
        advisories: {
          '1': { module_name: 'lodash', severity: 'low', title: 'Low thing' },
          '2': { module_name: 'jszip', severity: 'high', title: 'Path traversal', url: 'https://x/2' },
        },
      },
      '2026-10-24',
    )
    expect(report.findings).toBe(5)
    const md = report.markdown
    expect(md).toContain('Checked on 2026-10-24')
    expect(md.indexOf('## Vulnerabilities')).toBeLessThan(md.indexOf('## Newer releases'))
    expect(md.indexOf('`jszip`')).toBeLessThan(md.indexOf('`lodash`'))
    expect(md).toContain('[Path traversal](https://x/2)')
    expect(md.indexOf('`typescript`')).toBeLessThan(md.indexOf('`old`'))
    expect(md).toContain('| `typescript` | dev | 6.0.3 | 7.0.2 | major |')
    expect(md).toContain('| `old` (deprecated) | runtime | 1.0.0 | 1.1.0 | minor |')
  })

  it('lists majors held back on purpose without counting them', () => {
    const report = dependencyReport(
      { '@types/node': { current: '24.19.2', latest: '26.6.5' } },
      { advisories: {} },
      '2026-10-24',
    )
    expect(report.findings).toBe(0)
    expect(report.markdown).toContain('## Held back on purpose')
    expect(report.markdown).not.toContain('## Newer releases')
  })

  it('reports nothing to do when everything is current', () => {
    const report = dependencyReport({}, { advisories: {} }, '2026-10-24')
    expect(report.findings).toBe(0)
    expect(report.markdown).not.toContain('## Vulnerabilities')
    expect(report.markdown).not.toContain('## Newer releases')
  })
})
