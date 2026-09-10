import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

import { switchClasses } from './switchClasses'

/**
 * A mode key: something that changes what the *next* key means.
 *
 * Shared rather than written per keyboard, because three of them now carry one
 * — the dot and the tuplets on rhythmic dictation, the accidentals on scale
 * degrees, and all four on melodic dictation — and a switch that looked or
 * behaved differently between them would read as a different kind of control.
 *
 * `aria-pressed` rather than a checkbox: it is a button whose effect is to stay
 * down, which is exactly what a toggle button is.
 */
export interface SwitchProps {
  pressed: boolean
  disabled: boolean
  label: string
  /** The key that does the same thing, for a pointer to discover. Optional. */
  hint?: string
  onClick: () => void
  children: ReactNode
  className?: string
}

export function Switch({
  pressed,
  disabled,
  label,
  hint,
  onClick,
  children,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={hint === undefined ? label : `${label} (${hint})`}
      disabled={disabled}
      onClick={onClick}
      className={cn(switchClasses(pressed), className)}
    >
      {children}
    </button>
  )
}
