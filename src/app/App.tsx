import { useRef, useState } from 'react'
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
  const mainRef = useRef<HTMLDivElement | null>(null)
  const [playerFrameRect, setPlayerFrameRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  // Single subscription for the whole app: the runtime session (and therefore
  // the running SCO) outlives any one mode shell.
  const session = usePackageSession(mode)

  const playerFrameStyle =
    mode === 'basic' || playerFrameRect === null
      ? {
          top: 0,
          left: 256,
          right: 0,
          bottom: 36,
        }
      : {
          position: 'absolute' as const,
          left: playerFrameRect.left,
          top: playerFrameRect.top,
          width: playerFrameRect.width,
          height: playerFrameRect.height,
        }

  const handleAdvancedCenterRect = (rect: DOMRect | null) => {
    const toolbarHeight = 36
    if (!mainRef.current || rect === null) {
      setPlayerFrameRect(null)
      return
    }
    const mainRect = mainRef.current.getBoundingClientRect()
    setPlayerFrameRect({
      left: rect.left - mainRect.left,
      top: rect.top - mainRect.top,
      width: rect.width,
      height: Math.max(0, rect.height - toolbarHeight),
    })
  }

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
      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/*
          Persistent player layer. The SCO iframe must never leave the DOM:
          detaching it destroys the browsing context and kills the running
          course. Mode shells are chrome rendered on top of this layer, so a
          Basic ↔ Advanced switch only swaps chrome — the SCO keeps running.
          `left-64` clears Basic's 256px sidebar; `left-10` clears Advanced's
          40px activity bar; `bottom-9` clears the player toolbar.
        */}
        <div className="absolute inset-x-0" style={playerFrameStyle}>
          <PlayerFrame src={session.launchUrl} />
        </div>
        {mode === 'basic' ? (
          <BasicModeShell session={session} />
        ) : (
          <AdvancedModeShell
            session={session}
            onCenterRegionRectChange={handleAdvancedCenterRect}
          />
        )}
      </main>
    </div>
  )
}
