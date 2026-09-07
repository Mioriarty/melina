import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:bg-accent-press shadow-sm shadow-accent/20',
  secondary:
    'border border-rule bg-paper-raised text-ink hover:border-accent hover:text-accent',
  ghost: 'text-ink-muted hover:bg-accent-tint hover:text-accent',
}

const SIZES: Record<ButtonSize, string> = {
  // min-h keeps every control at or above the 44px touch target.
  sm: 'min-h-11 gap-1.5 px-3 text-sm',
  md: 'min-h-11 gap-2 px-4 text-[0.9375rem]',
}

/**
 * Class recipe shared by `Button` and by router `Link`s that must look like
 * buttons — a link that navigates should stay an anchor, not become a button
 * with an onClick.
 *
 * Lives apart from `Button.tsx` so that file only exports components and
 * React Fast Refresh keeps working.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center rounded-full font-medium',
    'transition-colors duration-150 ease-[--ease-out-soft]',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}
