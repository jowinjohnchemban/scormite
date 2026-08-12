/**
 * Panel component contributed by the built-in sample plugin (Milestone 13).
 *
 * It cannot import feature stores (boundary rule), so it renders what the
 * plugin host registry itself knows — proof the contribution actually
 * landed, without needing a running session.
 */

import { usePluginHost } from '../registry/PluginHost'

export function SamplePluginPanel() {
  // Select raw store slices only — selecting `Object.values(s.plugins)`
  // would create a new array each call, which React's useSyncExternalStore
  // sees as a change every render (infinite loop). Derive after the hook.
  const pluginRecord = usePluginHost((s) => s.plugins)
  const panels = usePluginHost((s) => s.panels)
  const commands = usePluginHost((s) => s.commands)
  const validators = usePluginHost((s) => s.validators)
  const plugins = Object.values(pluginRecord)

  return (
    <section tabIndex={0} className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-sm text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent">
      <div className="rounded border border-border-subtle bg-surface-950 p-3">
        <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Sample Plugin</h2>
        <p className="mt-1 text-xs text-slate-400">
          Registered by the built-in sample plugin (Milestone 13). Third-party
          plugins can register panels, commands, and validators the same way.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Active plugins" value={String(plugins.length)} />
        <Stat label="Panels" value={String(panels.length)} />
        <Stat label="Validators" value={String(validators.length)} />
      </div>

      <div className="rounded border border-border-subtle bg-surface-950 p-3">
        <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">Commands</h2>
        {commands.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No plugin commands registered.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs">
            {commands.map((command) => (
              <li key={command.id} className="text-slate-400">
                {command.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-950 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl text-slate-200">{value}</p>
    </div>
  )
}
