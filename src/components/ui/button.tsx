import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          // Accessibility: white text on the bright accent hover (#4da3ff) is only
          // 2.5:1, so the hover state inverts to dark text on the accent.
          'bg-accent-muted text-slate-50 hover:bg-accent hover:text-surface-950',
        outline: 'border border-border-subtle bg-transparent text-slate-200 hover:bg-surface-700',
        ghost: 'bg-transparent text-slate-300 hover:bg-surface-700',
        // Accessibility: white on the danger red (#f85149) is 3.2:1; dark text
        // gives 5.8:1 and keeps the token usable for accent text elsewhere.
        destructive: 'bg-danger text-surface-950 hover:opacity-90',
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
export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
