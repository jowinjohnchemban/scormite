import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent-muted)] text-slate-50 hover:bg-[var(--color-accent)]',
        outline:
          'border border-[var(--color-border-subtle)] bg-transparent text-slate-200 hover:bg-[var(--color-surface-700)]',
        ghost: 'bg-transparent text-slate-300 hover:bg-[var(--color-surface-700)]',
        destructive: 'bg-[var(--color-danger)] text-slate-50 hover:opacity-90',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2 text-xs',
        icon: 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

// `React.ComponentProps<'button'>` rather than `ButtonHTMLAttributes` so that
// `ref` is part of the props type — React 19 passes it as an ordinary prop.
export interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}

export { buttonVariants }
