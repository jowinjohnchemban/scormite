/**
 * A minimal popover menu.
 *
 * Deliberately named `menu` rather than `dropdown-menu`: shadcn's
 * `dropdown-menu` is a Radix wrapper, and this project can't run
 * `pnpm dlx shadcn add` in every environment (see CLAUDE.md). Keeping a
 * distinct filename means adding the real Radix component later is additive
 * rather than a conflicting overwrite.
 */

import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Button, type ButtonProps } from '@/components/ui/button'

interface MenuProps {
  /** Trigger button content. */
  label: React.ReactNode
  /** Accessible name, when `label` alone isn't descriptive. */
  ariaLabel?: string
  align?: 'start' | 'end'
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  children: React.ReactNode
}

export function Menu({
  label,
  ariaLabel,
  align = 'start',
  variant = 'ghost',
  size = 'sm',
  className,
  children,
}: MenuProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1 min-w-56 rounded-md border p-1 shadow-lg',
            'border-border-subtle bg-surface-800',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="presentation"
      className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
    >
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return (
    <div
      role="separator"
      className="my-1 h-px bg-border-subtle"
    />
  )
}

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Renders as a checkbox item and reflects state to assistive tech. */
  checked?: boolean
}

export function MenuItem({ checked, className, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      {...(checked === undefined ? {} : { 'aria-checked': checked })}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-300',
        'transition-colors hover:bg-surface-700 hover:text-slate-100',
        'focus-visible:outline-none focus-visible:bg-surface-700',
        '[&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}
