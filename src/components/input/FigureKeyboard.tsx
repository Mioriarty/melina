import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import {
  advance,
  arm,
  canAdvance,
  canArm,
  canPress,
  canRemove,
  isComplete,
  press,
  type FigureDraft,
} from '@/exercises/thoroughbass-figuring/draft'
import type { FigureAccidental } from '@/lib/music/figuredBass'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The figuring keyboard — a telephone pad.
 *
 * The grid is the point: everyone already knows where the 6 is, so the layout
 * costs nothing to learn, and the row under it falls where a phone's `* 0 #`
 * does.
 *
 * **The grammar is two keys, and it is the written notation itself.** A digit
 * adds a line to the column being typed, so `6` then `4` is the column `6/4`;
 * the dash closes that column and opens the next one under the same bass note,
 * so `4` `—` `3` is `4 – 3`. That mapping is one-to-one with what a figured
 * bass looks like on paper, which is the best property an entry keyboard can
 * have — and it means suspensions need no mechanism at all, only a generator
 * and a level.
 *
 * The dash is also the continuation line, when the day comes: pressed under a
 * *new* bass note it means "carry the figure over", which is not a second
 * meaning bolted on but the same one the horizontal line already has — "the
 * note to which the previous Figure refers is to be continued … over the new
 * Bass-note".
 *
 * **Why this one has a confirm key**, when nothing else in the app does: the
 * no-confirm rule is justified by a bar being exactly fillable, so that the
 * only press left is the one that completes it. A figure has no such bound —
 * one line, two, three — and inventing a fake one would be worse than a confirm
 * key. `✓` means *that is the figure*; and because a plain triad is written by
 * writing nothing, "no figure at all" is not a key to hunt for but simply
 * pressing done straight away.
 *
 * The accidentals are one-shot, like every other switch in the app, and an
 * armed accidental with no digit after it is the third — which is exactly what
 * the bare ♯ under a bass note means.
 *
 * On a desktop the whole thing can be typed: **1 to 9** enter a digit, **#**,
 * **b** and **n** arm the accidentals, **-** is the dash and **Enter** is done.
 * Not `+` and `-` as elsewhere, because here the minus key is the dash.
 */

export interface FigureKeyboardProps {
  draft: FigureDraft
  state?: KeyboardState
  onChange: (draft: FigureDraft) => void
  onRemove: () => void
  onFinish: () => void
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const ACCIDENTALS: readonly { id: FigureAccidental; glyph: string; hint: string }[] = [
  { id: 'sharp', glyph: '♯', hint: '#' },
  { id: 'flat', glyph: '♭', hint: 'b' },
  { id: 'natural', glyph: '♮', hint: 'n' },
]

export function FigureKeyboard({
  draft,
  state = 'answering',
  onChange,
  onRemove,
  onFinish,
}: FigureKeyboardProps) {
  const { t } = useTranslation('exercise')

  const revealed = state === 'revealed'
  const live = !revealed && !isComplete(draft)

  const pressDigit = useCallback(
    (number: number) => {
      if (!live || !canPress(draft, number)) return
      onChange(press(draft, number))
    },
    [draft, live, onChange],
  )

  const toggle = useCallback(
    (accidental: FigureAccidental) => {
      if (!live || !canArm(draft)) return
      onChange(arm(draft, accidental))
    },
    [draft, live, onChange],
  )

  const dash = useCallback(() => {
    if (!live || !canAdvance(draft)) return
    onChange(advance(draft))
  }, [draft, live, onChange])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable === true ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      ) {
        return
      }

      if (event.key === 'Backspace') {
        if (!live || !canRemove(draft)) return
        event.preventDefault()
        onRemove()
        return
      }
      if (event.key === 'Enter') {
        if (!live) return
        event.preventDefault()
        onFinish()
        return
      }
      if (event.key === '-') {
        if (!live || !canAdvance(draft)) return
        event.preventDefault()
        dash()
        return
      }

      const accidental = ACCIDENTALS.find((choice) => choice.hint === event.key)
      if (accidental !== undefined) {
        if (!live) return
        event.preventDefault()
        toggle(accidental.id)
        return
      }

      const number = Number(event.key)
      if (Number.isInteger(number) && number >= 1 && number <= 9) {
        event.preventDefault()
        pressDigit(number)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dash, draft, live, onFinish, onRemove, pressDigit, toggle])

  const padKey = 'h-auto min-h-12 w-16 text-base font-semibold disabled:opacity-35'

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.figure')}
      className="flex flex-col items-center gap-2"
    >
      <div className="flex items-center justify-center gap-1.5">
        {ACCIDENTALS.map((accidental) => (
          <Switch
            key={accidental.id}
            pressed={draft.armed === accidental.id}
            disabled={!live}
            label={t(`figuring.keyboard.${accidental.id}`)}
            hint={accidental.hint}
            onClick={() => toggle(accidental.id)}
          >
            {accidental.glyph}
          </Switch>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={!live || !canPress(draft, digit)}
            aria-label={t('figuring.keyboard.digit', { number: digit })}
            onClick={() => pressDigit(digit)}
            className={answerKeyClasses(
              { showCorrect: false, showWrong: false, revealed },
              padKey,
            )}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          disabled={!live || !canAdvance(draft)}
          onClick={dash}
          className={answerKeyClasses(
            { showCorrect: false, showWrong: false, revealed },
            padKey,
          )}
        >
          <Icon name="remove" size={20} label={t('figuring.keyboard.next')} />
        </button>

        <button
          type="button"
          disabled={!live}
          onClick={onFinish}
          className={cn(
            answerKeyClasses({ showCorrect: false, showWrong: false, revealed }, padKey),
            live && 'border-accent text-accent',
          )}
        >
          <Icon name="checkmark" size={20} label={t('figuring.keyboard.done')} />
        </button>

        <button
          type="button"
          disabled={!live || !canRemove(draft)}
          onClick={onRemove}
          className={answerKeyClasses(
            { showCorrect: false, showWrong: false, revealed },
            padKey,
          )}
        >
          <Icon name="backspace" size={20} label={t('figuring.keyboard.delete')} />
        </button>
      </div>
    </div>
  )
}
