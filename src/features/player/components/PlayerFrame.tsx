import { useRef, useEffect, useCallback } from 'react'
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
 */
export function PlayerFrame({ src, className, onLoad }: PlayerFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = useCallback(() => {
    onLoad?.()
  }, [onLoad])

  // Reload when src changes.
  useEffect(() => {
    if (!src || !iframeRef.current) return
    iframeRef.current.src = src
  }, [src])

  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center text-sm text-slate-500',
          className,
        )}
      >
        No package loaded.
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title="SCORM Package"
      src={src}
      // allow-same-origin is required for the SCO to find window.parent.API
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      className={cn('h-full w-full border-0 bg-white', className)}
      onLoad={handleLoad}
    />
  )
}
