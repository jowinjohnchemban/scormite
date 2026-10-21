import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/lib/utils'

const TONES = {
  error: { role: 'alert', className: 'border-red-500/40 bg-red-500/10 text-red-400' },
  warning: { role: 'status', className: 'border-warning/40 bg-warning/10 text-warning' },
} as const

/**
 * A dismissible strip under the header for something the open session
 * should know about — a failed load (the open package keeps running) or a
 * navigation the course's rules refused.
 */
export function SessionAlert({
  message,
  onDismiss,
  tone = 'error',
}: {
  message: string | null
  onDismiss: () => void
  tone?: keyof typeof TONES
}) {
  if (!message) return null
  const style = TONES[tone]
  return (
    <div role={style.role} className={cn('flex shrink-0 items-start gap-2 border-b px-3 py-1.5 text-xs', style.className)}>
      <p className="min-w-0 flex-1 py-1">{message}</p>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Dismiss message" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}
