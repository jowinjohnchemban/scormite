import { useAppModeStore } from '@/app/state/appModeStore'
import { BasicModeShell } from '@/app/modes/BasicModeShell'
import { AdvancedModeShell } from '@/app/modes/AdvancedModeShell'
import { Button } from '@/components/ui/button'

export function App() {
  const mode = useAppModeStore((s) => s.mode)
  const setMode = useAppModeStore((s) => s.setMode)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-900)] px-3 text-sm">
        <span className="font-medium tracking-tight">SCORM Studio</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === 'basic' ? 'default' : 'ghost'}
            onClick={() => setMode('basic')}
          >
            Basic
          </Button>
          <Button
            size="sm"
            variant={mode === 'advanced' ? 'default' : 'ghost'}
            onClick={() => setMode('advanced')}
          >
            Advanced
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {mode === 'basic' ? <BasicModeShell /> : <AdvancedModeShell />}
      </main>
    </div>
  )
}
