import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { useMusicNames, type MusicNames } from '@/hooks/useMusicNames'
import { QUALITY_ORDER } from '@/lib/music/catalog'
import {
  intervalKey,
  intervalsEqual,
  type Interval,
  type IntervalQuality,
} from '@/lib/music/interval'

import { answerKeyClasses, type KeyboardState } from './keyClasses'

/**
 * The interval keyboard.
 *
 * Rows are interval numbers. Within a row the qualities are packed together
 * and the row is balanced about a shared centre line: "Perfect" always sits
 * on that line, the qualities smaller than perfect run leftwards from it and
 * the larger ones rightwards. A row does not reserve space for qualities it
 * does not have, so a second shows Minor and Major side by side rather than
 * with a perfect-sized hole between them.
 *
 * Only the offered intervals render, so enabling "diminished third" in the
 * settings adds exactly one button.
 */

export interface IntervalKeyboardProps {
  /** Exactly the intervals that may be answered. */
  options: readonly Interval[]
  onAnswer: (interval: Interval) => void
  state?: KeyboardState
  /** What the player picked, once they have picked. */
  chosen?: Interval | undefined
  /** The right answer, shown when `state` is `revealed`. */
  correct?: Interval | undefined
}

const PERFECT_INDEX = QUALITY_ORDER.indexOf('perfect')

function qualityIndex(quality: IntervalQuality): number {
  return QUALITY_ORDER.indexOf(quality)
}

interface Row {
  number: number
  /** This row's intervals only, ordered smallest quality first. */
  entries: readonly Interval[]
}

export function IntervalKeyboard({
  options,
  onAnswer,
  state = 'answering',
  chosen,
  correct,
}: IntervalKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()
  const rows = useMemo<Row[]>(() => {
    const numbers = [...new Set(options.map((option) => option.number))].sort(
      (a, b) => a - b,
    )
    return numbers.map((number) => ({
      number,
      entries: options
        .filter((option) => option.number === number)
        .sort((a, b) => qualityIndex(a.quality) - qualityIndex(b.quality)),
    }))
  }, [options])

  const [focus, setFocus] = useState({ row: 0, index: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Derived, not stored: when the offered set changes the remembered focus
  // can point past the end of a row, and clamping it here avoids a
  // correcting render just to move it back onto a real button.
  const active = useMemo(() => {
    const entries = rows[focus.row]?.entries
    if (entries !== undefined && focus.index < entries.length) return focus
    return { row: 0, index: 0 }
  }, [focus, rows])

  const moveFocus = useCallback((next: { row: number; index: number }) => {
    setFocus(next)
    // Move real DOM focus too, so the browser scrolls it into view and a
    // screen reader announces it.
    const selector = `[data-cell="${next.row}-${next.index}"]`
    containerRef.current?.querySelector<HTMLButtonElement>(selector)?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { row, index } = active
      const entries = rows[row]?.entries
      if (entries === undefined) return

      let target: { row: number; index: number } | undefined

      if (event.key === 'ArrowRight' && index + 1 < entries.length) {
        target = { row, index: index + 1 }
      } else if (event.key === 'ArrowLeft' && index > 0) {
        target = { row, index: index - 1 }
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const nextRow = row + (event.key === 'ArrowDown' ? 1 : -1)
        const candidates = rows[nextRow]?.entries
        if (candidates !== undefined && candidates.length > 0) {
          // Land on the nearest quality rather than the same position: from
          // a major third, down should reach a major sixth, not whatever
          // happens to sit at index 1.
          const current = qualityIndex(entries[index]?.quality ?? 'perfect')
          let best = 0
          for (let i = 1; i < candidates.length; i += 1) {
            const here = Math.abs(qualityIndex(candidates[i]!.quality) - current)
            const winner = Math.abs(qualityIndex(candidates[best]!.quality) - current)
            if (here < winner) best = i
          }
          target = { row: nextRow, index: best }
        }
      } else if (event.key === 'Home') {
        target = { row, index: 0 }
      } else if (event.key === 'End') {
        target = { row, index: entries.length - 1 }
      }

      if (target === undefined) return
      event.preventDefault()
      moveFocus(target)
    },
    [active, moveFocus, rows],
  )

  const revealed = state === 'revealed'

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t('round.keyboardLabel.interval')}
      onKeyDown={handleKeyDown}
      className="grid gap-1.5"
    >
      {rows.map((row, rowIndex) => {
        const smaller = row.entries.filter(
          (entry) => qualityIndex(entry.quality) < PERFECT_INDEX,
        )
        const perfect = row.entries.find((entry) => entry.quality === 'perfect')
        const larger = row.entries.filter(
          (entry) => qualityIndex(entry.quality) > PERFECT_INDEX,
        )

        const keyFor = (interval: Interval) => (
          <Key
            key={intervalKey(interval)}
            interval={interval}
            cell={`${rowIndex}-${row.entries.indexOf(interval)}`}
            focused={
              active.row === rowIndex && active.index === row.entries.indexOf(interval)
            }
            revealed={revealed}
            isChosen={chosen !== undefined && intervalsEqual(chosen, interval)}
            isCorrect={correct !== undefined && intervalsEqual(correct, interval)}
            onFocus={() =>
              setFocus({ row: rowIndex, index: row.entries.indexOf(interval) })
            }
            onSelect={() => onAnswer(interval)}
            names={names}
          />
        )

        return (
          <div key={row.number} className="flex items-center gap-1.5">
            <span className="w-[4.25rem] shrink-0 font-serif text-[0.9375rem] font-semibold text-ink-muted">
              {names.number(row.number)}
            </span>

            {/* The two halves share the remaining width equally, which puts
                the perfect slot — or, when there is none, the seam between
                the halves — on the same centre line in every row. */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                data-slot="smaller"
                className="flex min-w-0 flex-1 justify-end gap-1.5"
              >
                {smaller.map(keyFor)}
              </div>

              {perfect !== undefined && (
                <div data-slot="perfect" className="shrink-0">
                  {keyFor(perfect)}
                </div>
              )}

              <div
                data-slot="larger"
                className="flex min-w-0 flex-1 justify-start gap-1.5"
              >
                {larger.map(keyFor)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KeyProps {
  interval: Interval
  cell: string
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
  interval,
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

  return (
    <button
      type="button"
      data-cell={cell}
      data-interval={intervalKey(interval)}
      tabIndex={focused ? 0 : -1}
      disabled={revealed}
      aria-label={names.interval(interval)}
      onFocus={onFocus}
      onClick={onSelect}
      className={answerKeyClasses({ showCorrect, showWrong, revealed })}
    >
      <span className="sm:hidden">{names.qualityShort(interval.quality)}</span>
      <span className="hidden sm:inline">{names.quality(interval.quality)}</span>

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
