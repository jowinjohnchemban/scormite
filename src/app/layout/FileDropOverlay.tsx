/**
 * Full-window drop target shown while a file is dragged over an open
 * session. It also sits above the player iframe, which would otherwise
 * swallow the drag events.
 */
export function FileDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 p-8">
      <div className="flex w-full max-w-lg flex-col items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-accent/10 px-8 py-12 text-center">
        <p className="text-sm font-medium text-slate-200">Drop to open this package</p>
        <p className="text-xs text-slate-500">The current session will be closed.</p>
      </div>
    </div>
  )
}
