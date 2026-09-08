import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { useMusicNames, type MusicNames } from '@/hooks/useMusicNames'
import { MODE_IDS, type ModeId } from '@/lib/music/scale'

import { answerKeyClasses, type KeyboardState } from './keyClasses'

/**
 * The scale keyboard.
 *
 * One key per mode, flowing across the bar and wrapping where it runs out of
 * room. There is nothing to group them by — a mode is not a quality of some
 * larger thing the way a major third is a quality of a third — so they are
 * simply listed, in the order the modes rotate through the major scale.
 *
 * That order is fixed rather than following the offered set, so a mode keeps
 * its place on the keyboard whatever a level allows.
 */

export interface ScaleKeyboardProps {
  /** Exactly the modes that may be answered. */
  options: readonly ModeId[]
  onAnswer: (mode: ModeId) => void
  state?: KeyboardState
  /** What the player picked, once they have picked. */
  chosen?: ModeId | undefined
  /** The right answer, shown when `state` is `revealed`. */
  correct?: ModeId | undefined
}

export function ScaleKeyboard({
  options,
  onAnswer,
  state = 'answering',
  chosen,
  correct,
}: ScaleKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const modes = useMemo(
    () => MODE_IDS.filter((mode) => options.includes(mode)),
    [options],
  )

  const [focus, setFocus] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Derived, not stored: a remembered index can point past the end of a
  // shorter set, and clamping here avoids a correcting render just to put
  // focus back on a real key.
  const active = focus < modes.length ? focus : 0

  const moveFocus = useCallback((next: number) => {
    setFocus(next)
    // Move real DOM focus too, so the browser scrolls it into view and a
    // screen reader announces it.
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)
      ?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // The keys wrap, so how many sit on a row depends on the width. Rather
      // than guess at a grid that is not really there, every arrow walks the
      // one sequence — which is also what a screen reader announces.
      let target: number | undefined

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (active + 1 < modes.length) target = active + 1
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        if (active > 0) target = active - 1
      } else if (event.key === 'Home') {
        target = 0
      } else if (event.key === 'End') {
        target = modes.length - 1
      }

      if (target === undefined) return
      event.preventDefault()
      moveFocus(target)
    },
    [active, modes.length, moveFocus],
  )

  const revealed = state === 'revealed'

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t('round.keyboardLabel.scale')}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap justify-center gap-1.5"
    >
      {modes.map((mode, index) => (
        <Key
          key={mode}
          mode={mode}
          cell={index}
          focused={active === index}
          revealed={revealed}
          isChosen={chosen === mode}
          isCorrect={correct === mode}
          onFocus={() => setFocus(index)}
          onSelect={() => onAnswer(mode)}
          names={names}
        />
      ))}
    </div>
  )
}

interface KeyProps {
  mode: ModeId
  cell: number
  focused: boolean
  revealed: boolean
  isChosen: boolean
  isCorrect: boolean
  onFocus: () => void
  onSelect: () => void
  /** Passed down rather than re-derived: one hook call per keyboard, not per key. */
  names: MusicNames
}

function Key({
  mode,
  cell,
  focused,
  revealed,
  isChosen,
  isCorrect,
  onFocus,
  onSelect,
  names,
}: KeyProps) {
  const showCorrect = revealed && isCorrect
  const showWrong = revealed && isChosen && !isCorrect
  const alias = names.modeAlias(mode)

  return (
    <button
      type="button"
      data-cell={cell}
      data-mode={mode}
      tabIndex={focused ? 0 : -1}
      disabled={revealed}
      // Ionian and Aeolian are far better known as major and minor, so the
      // spoken name carries both.
      aria-label={names.modeFull(mode)}
      onFocus={onFocus}
      onClick={onSelect}
      className={answerKeyClasses({ showCorrect, showWrong, revealed }, 'gap-1.5')}
    >
      {names.mode(mode)}
      {alias !== '' && (
        <span className={showCorrect || showWrong ? 'text-white/75' : 'text-ink-faint'}>
          {alias}
        </span>
      )}

      {/* Never colour alone: the result also carries a glyph. */}
      {(showCorrect || showWrong) && (
        <Icon
          name={showCorrect ? 'correct' : 'wrong'}
          size={15}
          className="absolute -top-1.5 -right-1.5 rounded-full bg-white"
        />
      )}
    </button>
  )
}
