import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export interface TagProps {
  children: ReactNode
  tone?: 'accent' | 'muted'
  className?: string
}

/** Small status pill — "Coming soon", counts, and similar metadata. */
export function Tag({ children, tone = 'muted', className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-[0.6875rem] font-medium tracking-wide uppercase',
        tone === 'accent' ? 'bg-accent-tint text-accent' : 'bg-ink/5 text-ink-faint',
        className,
      )}
    >
      {children}
    </span>
  )
}
