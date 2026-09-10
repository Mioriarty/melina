import { cn } from '@/lib/utils/cn'

/**
 * The look of a single answer key, shared by every keyboard.
 *
 * A sibling module rather than an exported helper in a component file, so
 * React Fast Refresh keeps working — the same split as `ui/Button.tsx` and
 * `ui/buttonClasses.ts`. The interval keyboard and the scale keyboard lay
 * their keys out completely differently and must still feel like one control,
 * which they only will if the key itself is written once.
 */

export type KeyboardState = 'answering' | 'revealed'

export interface AnswerKeyLook {
  /** This key is the right answer, and the round has revealed it. */
  showCorrect: boolean
  /** This key is what the player picked, and it was wrong. */
  showWrong: boolean
  /** The question has been answered, so nothing is pressable any more. */
  revealed: boolean
}

export function answerKeyClasses(
  { showCorrect, showWrong, revealed }: AnswerKeyLook,
  className?: string,
): string {
  return cn(
    'relative flex min-h-11 min-w-0 items-center justify-center rounded-full px-3',
    'border text-[0.8125rem] font-medium whitespace-nowrap',
    // A key that gives back nothing under a thumb gives back nothing at all:
    // a touch screen has no hover, so the press itself has to be visible.
    'transition-[background-color,border-color,color,transform] duration-150',
    'active:scale-95 disabled:cursor-default disabled:active:scale-100',
    showCorrect && 'border-correct bg-correct text-white',
    showWrong && 'border-wrong bg-wrong text-white',
    !showCorrect &&
      !showWrong && [
        'border-rule bg-paper-raised text-ink',
        !revealed && 'hover:border-accent hover:text-accent',
        revealed && 'opacity-45',
      ],
    className,
  )
}
