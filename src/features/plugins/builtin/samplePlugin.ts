/**
 * Built-in sample plugin — the "trivial sample plugin" from Milestone 13's
 * exit criteria. It registers one panel, one command, and one validator to
 * prove the whole contribution surface works end-to-end without touching
 * core code.
 *
 * Deliberately self-contained: it only touches the plugin contract, shared
 * types, and same-feature code — exactly what a third-party plugin can do.
 * The panel component lives in `SamplePluginPanel.tsx` (kept separate so
 * this file stays free of JSX).
 */

import { Puzzle } from 'lucide-react'
import type { ScormitePlugin } from '../types'
import { SamplePluginPanel } from './SamplePluginPanel'

export const samplePlugin: ScormitePlugin = {
  manifest: {
    id: 'scormite.sample',
    name: 'Sample Plugin',
    version: '1.0.0',
    description:
      'Milestone 13 proof plugin: contributes a panel, a command, and a validator.',
  },

  activate(api) {
    api.registerPanel({
      id: 'sample-about',
      title: 'Sample Plugin',
      defaultRegion: 'bottom',
      defaultOpen: false,
      icon: Puzzle,
      component: SamplePluginPanel,
    })

    api.registerCommand({
      id: 'sample.greet',
      title: 'Sample Plugin: greet the console',
      run: () => {
        if (import.meta.env.DEV) {
          console.info('[Sample Plugin] Hello from the sample plugin.')
        }
      },
    })

    api.registerValidator({
      ruleId: 'runtime.sample-commit-echo',
      severity: 'warning',
      check: (result, ctx) => {
        if (result.method !== 'Commit') return null
        return ctx.sawCommit
          ? null
          : 'Sample plugin rule: Commit returned false (the LMS rejected it).'
      },
    })
  },
}
