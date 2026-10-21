import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * A load error while a package is already open. The open session stays
 * usable, so the error is a dismissible strip rather than a page swap.
 */
export function SessionAlert({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 border-b border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400"
    >
      <p className="min-w-0 flex-1 py-1">{message}</p>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Dismiss error" onClick={onDismiss}>
        <X aria-hidden />
      </Button>
    </div>
  )
}
