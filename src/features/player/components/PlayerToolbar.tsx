import { Button } from '@/components/ui/button'

interface PlayerToolbarProps {
  onReload: () => void
  onReset: () => void
  disabled?: boolean
}

export function PlayerToolbar({ onReload, onReset, disabled = false }: PlayerToolbarProps) {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-1 border-t border-border-subtle bg-surface-900 px-2 py-1">
      <Button size="sm" variant="ghost" onClick={onReload} disabled={disabled}>
        Reload
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset} disabled={disabled}>
        Reset
      </Button>
    </div>
  )
}
