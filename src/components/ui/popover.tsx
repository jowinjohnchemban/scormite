/**
 * A minimal popover: a trigger button and a non-modal dialog for small
 * forms. Unlike `Menu` (role="menu", menu items only), a popover may hold
 * any content, including inputs. Closes on Escape (returning focus to the
 * trigger) and on a click outside.
 */

import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'

interface PopoverProps {
  /** Trigger button content. */
  label: React.ReactNode
  /** Accessible name of the trigger, when `label` alone isn't descriptive. */
  ariaLabel?: string
  /** Accessible name of the dialog. */
  title: string
  align?: 'start' | 'end'
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  /** Tooltip for the trigger. */
  triggerTitle?: string
  children: React.ReactNode
}

const PopoverCloseContext = React.createContext<() => void>(() => {})

/** Close the enclosing popover (returning focus to its trigger). */
export function usePopoverClose(): () => void {
  return React.useContext(PopoverCloseContext)
}

export function Popover({
  label,
  ariaLabel,
  title,
  align = 'start',
  variant = 'ghost',
  size = 'sm',
  className,
  triggerTitle,
  children,
}: PopoverProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const dialogId = React.useId()

  const close = React.useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(triggerTitle ? { title: triggerTitle } : {})}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={title}
          className={cn(
            'absolute top-full z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-md border p-3 shadow-lg',
            'border-border-subtle bg-surface-800',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <PopoverCloseContext value={close}>{children}</PopoverCloseContext>
        </div>
      )}
    </div>
  )
}
