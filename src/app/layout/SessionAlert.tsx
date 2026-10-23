import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/lib/utils'

const TONES = {
  error: { role: 'alert', className: 'border-red-500/40 bg-red-500/10 text-red-400' },
  warning: { role: 'status', className: 'border-warning/40 bg-warning/10 text-warning' },
  info: { role: 'status', className: 'border-accent/40 bg-accent/10 text-accent' },
} as const

/**
 * A dismissible strip under the header for something the open session
 * should know about — a failed load (the open package keeps running) or a
 * navigation the course's rules refused — optionally with one action, such
 * as starting fresh instead of resuming.
 */
export function SessionAlert({
  message,
  onDismiss,
  tone = 'error',
  action,
}: {
  message: string | null
  onDismiss: () => void
  tone?: keyof typeof TONES
  action?: { label: string; onClick: () => void }
}) {
  if (!message) return null
  const style = TONES[tone]
  return (
    <div
      role={style.role}
      className={cn('flex shrink-0 items-start gap-2 border-b px-3 py-1.5 text-xs', style.className)}
    >
      <p className="min-w-0 flex-1 py-1">{message}</p>
      {action && (
        <Button variant="outline" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      <Button variant="ghost" size="icon" className="size-6" aria-label="Dismiss message" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}
