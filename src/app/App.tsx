import { useAppModeStore } from '@/app/state/appModeStore'
import { BasicModeShell } from '@/app/modes/BasicModeShell'
import { AdvancedModeShell } from '@/app/modes/AdvancedModeShell'
import { usePackageSession } from '@/app/hooks/usePackageSession'
import { PlayerFrame } from '@/features/player'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/lib/utils'
import logo from '@/assets/hero.png'
import { logDevDiagnostic } from '@/shared/lib/devDiagnostics'

export function App() {
  const mode = useAppModeStore((s) => s.mode)
  const setMode = useAppModeStore((s) => s.setMode)
  // Single subscription for the whole app: the runtime session (and therefore
  // the running SCO) outlives any one mode shell.
  const session = usePackageSession(mode)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-900)] px-3 text-sm">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Scormite" className="h-6 w-6 object-contain" />
          <span className="font-medium tracking-tight">Scormite</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === 'basic' ? 'default' : 'ghost'}
            onClick={() => {
              logDevDiagnostic('mode.change.requested', { from: mode, to: 'basic' })
              setMode('basic')
            }}
          >
            Basic
          </Button>
          <Button
            size="sm"
            variant={mode === 'advanced' ? 'default' : 'ghost'}
            onClick={() => {
              logDevDiagnostic('mode.change.requested', { from: mode, to: 'advanced' })
              setMode('advanced')
            }}
          >
            Advanced
          </Button>
        </div>
      </header>
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/*
          Persistent player layer. The SCO iframe must never leave the DOM:
          detaching it destroys the browsing context and kills the running
          course. Mode shells are chrome rendered on top of this layer, so a
          Basic ↔ Advanced switch only swaps chrome — the SCO keeps running.
          `left-64` clears Basic's 256px sidebar; `left-10` clears Advanced's
          40px activity bar.
        */}
        <div
          className={cn(
            'absolute inset-y-0 right-0',
            mode === 'basic' ? 'left-64' : 'left-10',
          )}
        >
          <PlayerFrame src={session.launchUrl} />
        </div>
        {mode === 'basic' ? (
          <BasicModeShell session={session} />
        ) : (
          <AdvancedModeShell session={session} />
        )}
      </main>
    </div>
  )
}
