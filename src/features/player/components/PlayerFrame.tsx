import { useCallback } from 'react'
import { cn } from '@/shared/lib/utils'

interface PlayerFrameProps {
  /** Full URL to load in the iframe (from PlayerBridgeService.packageLaunchUrl). */
  src: string | null
  className?: string
  onLoad?: () => void
}

/**
 * Sandboxed iframe that runs the SCORM SCO.
 * The SCORM API proxy lives on window.API / window.API_1484_11 (set by
 * PlayerBridgeService.injectApiProxy before this component mounts).
 *
 * The caller keys it per launch, so each launch is a fresh iframe whose `src`
 * is set exactly once. Assigning `src` again — even the same URL — restarts
 * the page load, so the SCO would start loading twice.
 */
export function PlayerFrame({ src, className, onLoad }: PlayerFrameProps) {
  const handleLoad = useCallback(() => {
    if (import.meta.env.DEV) console.debug('[Scormite player] iframe loaded', { src })
    onLoad?.()
  }, [onLoad, src])

  // Between launches (and after a course ends) there is nothing to show.
  if (!src) {
    return <div className={cn('h-full bg-surface-950', className)} />
  }

  return (
    <iframe
      title="SCORM Package"
      src={src}
      // allow-same-origin is required for the SCO to find window.parent.API
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      className={cn('h-full w-full border-0 bg-white', className)}
      onLoad={handleLoad}
      onError={() => {
        if (import.meta.env.DEV) console.error('[Scormite player] iframe failed to load', { src })
      }}
    />
  )
}
