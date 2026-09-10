import { cn } from '@/lib/utils/cn'

/**
 * The look of a mode key, in a sibling module so `Switch.tsx` exports only a
 * component and React Fast Refresh keeps working — the same split as
 * `ui/Button.tsx` and `ui/buttonClasses.ts`.
 */
export function switchClasses(pressed: boolean): string {
  return cn(
    'inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3',
    'text-[1.0625rem] transition-[background-color,border-color,color,transform] duration-150',
    // The press is felt as well as seen — see `keyClasses.ts`.
    'active:scale-95',
    pressed
      ? 'border-accent bg-accent-tint text-accent'
      : 'border-rule bg-paper-raised text-ink-muted hover:border-accent hover:text-accent',
    'disabled:cursor-default disabled:opacity-40 disabled:active:scale-100',
  )
}
