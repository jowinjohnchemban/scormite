import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useAppModeStore } from '@/app/state/appModeStore'
import { useCourseStore } from '@/app/state/courseStore'
import { BasicModeShell } from '@/app/modes/BasicModeShell'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { usePackageSession } from '@/app/hooks/usePackageSession'
import { useWindowFileDrop } from '@/app/hooks/useWindowFileDrop'
import { SessionControls } from '@/app/layout/SessionControls'
import { SessionAlert } from '@/app/layout/SessionAlert'
import { FileDropOverlay } from '@/app/layout/FileDropOverlay'
import { ErrorBoundary } from '@/app/layout/ErrorBoundary'
import { ScoEndedBar } from '@/app/course/ScoEndedBar'
import { PlayerFrame } from '@/features/player'
import { Button } from '@/components/ui/button'
import { logDevDiagnostic } from '@/shared/lib/devDiagnostics'

// The dock and its panels are only downloaded when Advanced mode is opened.
const AdvancedModeShell = lazy(() =>
  import('@/app/modes/AdvancedModeShell').then((module) => ({ default: module.AdvancedModeShell })),
)

interface FrameRect {
  left: number
  top: number
  width: number
  height: number
}

export function App() {
  const mode = useAppModeStore((s) => s.mode)
  const setMode = useAppModeStore((s) => s.setMode)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (!isDesktop && mode === 'advanced') setMode('basic')
  }, [isDesktop, mode, setMode])
  const mainRef = useRef<HTMLElement | null>(null)
  const [playerFrameRect, setPlayerFrameRect] = useState<FrameRect | null>(null)

  // Single subscription for the whole app: the runtime session (and therefore
  // the running SCO) outlives any one mode shell.
  const session = usePackageSession(mode)
  const notice = useCourseStore((s) => s.notice)
  const setNotice = useCourseStore((s) => s.setNotice)
  const dismissNotice = useCallback(() => setNotice(null), [setNotice])
  const draggingFile = useWindowFileDrop(true, (file) => void session.loadFile(file))

  const playerFrameStyle =
    mode === 'basic' || !isDesktop || playerFrameRect === null
      ? isDesktop
        ? // Clears Basic's 256px sidebar.
          { top: 0, left: 256, right: 0, bottom: 0 }
        : // Below Basic's 40vh stacked sidebar on narrow screens.
          { top: '40vh', left: 0, right: 0, bottom: 0 }
      : {
          position: 'absolute' as const,
          left: playerFrameRect.left,
          top: playerFrameRect.top,
          width: playerFrameRect.width,
          height: playerFrameRect.height,
        }

  const handleAdvancedCenterRect = useCallback((rect: DOMRect | null) => {
    if (!mainRef.current || rect === null) {
      setPlayerFrameRect(null)
      return
    }
    const mainRect = mainRef.current.getBoundingClientRect()
    setPlayerFrameRect({
      left: rect.left - mainRect.left,
      top: rect.top - mainRect.top,
      width: rect.width,
      height: rect.height,
    })
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-900 px-3 text-sm">
        <div className="flex shrink-0 items-center gap-2">
          {/* Drawn on a 24-unit grid, so it renders pixel-exact at this size. */}
          <img src="/logo-mark-24.svg" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="font-medium tracking-tight">SCORMite</span>
          {/* The landing screen carries the visible h1; in a session the page is about the package. */}
          {session.pkg && <h1 className="sr-only">{session.pkg.name} — SCORMite</h1>}
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <SessionControls session={session} />
          {/* Advanced mode needs a wide screen, so the switch only appears where it works. */}
          {session.pkg && <div className="mx-1 hidden h-5 w-px shrink-0 bg-border-subtle lg:block" aria-hidden />}
          <div className="hidden shrink-0 items-center gap-1 lg:flex" role="group" aria-label="View mode">
            <Button
              size="sm"
              variant={mode === 'basic' ? 'default' : 'ghost'}
              aria-pressed={mode === 'basic'}
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
              aria-pressed={mode === 'advanced'}
              disabled={!isDesktop}
              title={isDesktop ? 'Advanced mode: dockable developer panels' : 'Advanced mode needs a wider screen (1024px+)'}
              onClick={() => {
                if (!isDesktop) return
                logDevDiagnostic('mode.change.requested', { from: mode, to: 'advanced' })
                setMode('advanced')
              }}
            >
              Advanced
            </Button>
          </div>
        </div>
      </header>
      <SessionAlert message={session.pkg ? session.error : null} onDismiss={session.dismissError} />
      <SessionAlert message={notice} onDismiss={dismissNotice} tone="warning" />
      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/*
          Persistent player layer. The SCO iframe must never leave the DOM on
          a mode switch: detaching it destroys the browsing context and kills
          the running course. Mode shells are chrome rendered on top of this
          layer, so a Basic ↔ Advanced switch only swaps chrome. The key only
          changes on a deliberate (re)launch, which must remount the iframe.
        */}
        <div className="absolute inset-x-0" style={playerFrameStyle}>
          <PlayerFrame key={session.launchKey} src={session.launchUrl} />
          <ScoEndedBar session={session} />
        </div>
        <ErrorBoundary resetKey={session.pkg?.id ?? null}>
          {!isDesktop || mode === 'basic' ? (
            <BasicModeShell session={session} />
          ) : (
            <Suspense fallback={null}>
              <AdvancedModeShell
                session={session}
                onCenterRegionRectChange={handleAdvancedCenterRect}
              />
            </Suspense>
          )}
        </ErrorBoundary>
      </main>
      <FileDropOverlay visible={draggingFile && session.pkg !== null} />
    </div>
  )
}
