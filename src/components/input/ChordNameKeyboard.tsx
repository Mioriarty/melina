import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import {
  chordSize,
  inversionFigure,
  memberAt,
  type Chord,
  type ChordQuality,
} from '@/lib/music/chord'
import { tonicKey } from '@/lib/music/scale'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'

/**
 * The naming keyboard: one row per thing a chord's name says.
 *
 * Root, quality, position, Lage — read down the rows and it is the name in the
 * order you would speak it. **Only the rows the round actually asks for are
 * drawn**, so an early level is two rows and the last one is four, and hearing
 * never shows the root because a chord in isolation has no audible one.
 *
 * **There is no confirm key**, and it earns that the way rhythmic dictation
 * does rather than by copying it: the answer is *exactly fillable*. Each row
 * admits one choice, so when every row the question needs has one, the only
 * press left was the one that completed it — and that is the press that
 * answers.
 *
 * The position and Lage rows are pressable before a quality has been chosen,
 * which is why their key faces are size-independent (`1st`, `1. Umk.`): a
 * triad's first inversion is the Sextakkord and a seventh chord's is the
 * Quintsextakkord, so a face that knew which would have to relabel itself
 * under the player's hand. The full name and the figure arrive underneath once
 * the quality has said which it is.
 *
 * A choice that the quality rules out is cleared rather than left standing —
 * picking a triad after choosing a third inversion cannot leave a third
 * inversion selected, because a triad has none.
 */

export interface ChordNameKeyboardProps {
  /** Which rows to draw. */
  rows: { root: boolean; inversion: boolean; lage: boolean }
  /** Roots the level offers, as tonic keys. */
  roots: readonly string[]
  qualities: readonly ChordQuality[]
  /** Which inversions this quality may be asked in — empty means not asked. */
  inversionsFor: (quality: ChordQuality) => readonly number[]
  state?: KeyboardState
  /** The chord that was wanted, revealed once the question is answered. */
  correct?: Chord | undefined
  onAnswer: (answer: {
    root: string | undefined
    quality: ChordQuality
    inversion: number | undefined
    top: number | undefined
  }) => void
}

export function ChordNameKeyboard({
  rows,
  roots,
  qualities,
  inversionsFor,
  state = 'answering',
  correct,
  onAnswer,
}: ChordNameKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [root, setRoot] = useState<string>()
  const [quality, setQuality] = useState<ChordQuality>()
  const [inversion, setInversion] = useState<number>()
  const [top, setTop] = useState<number>()

  const revealed = state === 'revealed'

  /** How many members the chord has, once the quality says. Four until then. */
  const size = quality === undefined ? 4 : chordSize(quality)

  /** Which positions this row offers, and whether it still needs an answer. */
  const positions = useMemo(
    () => (quality === undefined ? [0, 1, 2, 3] : inversionsFor(quality)),
    [inversionsFor, quality],
  )
  const needsInversion = rows.inversion && positions.length > 1
  const needsLage = rows.lage && size > 2

  const members = useMemo(
    () => Array.from({ length: size }, (_, member) => member),
    [size],
  )

  /**
   * Answer as soon as every row the question needs has been filled.
   *
   * Reads the values it is given rather than the state, because the press that
   * completes the answer has not been committed yet when it runs.
   */
  const settle = useCallback(
    (next: {
      root: string | undefined
      quality: ChordQuality | undefined
      inversion: number | undefined
      top: number | undefined
    }) => {
      if (revealed || next.quality === undefined) return
      const wanted = inversionsFor(next.quality)
      if (rows.root && next.root === undefined) return
      if (rows.inversion && wanted.length > 1 && next.inversion === undefined) return
      if (rows.lage && next.top === undefined) return

      onAnswer({
        root: rows.root ? next.root : undefined,
        quality: next.quality,
        // A row that was not required did not ask, so it has nothing to say —
        // the verdict reads the same `asks` and will not look at it.
        inversion: rows.inversion && wanted.length > 1 ? next.inversion : undefined,
        top: rows.lage ? next.top : undefined,
      })
    },
    [inversionsFor, onAnswer, revealed, rows],
  )

  const current = { root, quality, inversion, top }

  /**
   * Picking a quality can invalidate what is already chosen — a triad has no
   * third inversion, and no member beyond its fifth to put on top — so the
   * press that causes it is the press that clears it. Doing that in an effect
   * instead would render once with a selection the chord cannot have.
   */
  const pickQuality = (id: ChordQuality) => {
    const wanted = inversionsFor(id)
    const nextSize = chordSize(id)
    const nextInversion =
      inversion !== undefined && wanted.includes(inversion) ? inversion : undefined
    const nextTop =
      top !== undefined && top < nextSize && top !== nextInversion ? top : undefined

    setQuality(id)
    setInversion(nextInversion)
    setTop(nextTop)
    settle({ root, quality: id, inversion: nextInversion, top: nextTop })
  }

  /** A member cannot be at the bottom and the top at once. */
  const pickInversion = (member: number) => {
    const nextTop = top === member ? undefined : top
    setInversion(member)
    setTop(nextTop)
    settle({ ...current, inversion: member, top: nextTop })
  }

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.chordName')}
      className="flex flex-col gap-2"
    >
      {rows.root && (
        <Row label={t('chord.keyboard.root')}>
          {roots.map((key) => (
            <Key
              key={key}
              label={names.tonic(key)}
              spoken={names.tonic(key)}
              picked={root === key}
              right={revealed && correct !== undefined && tonicKey(correct.root) === key}
              wrong={
                revealed &&
                root === key &&
                correct !== undefined &&
                tonicKey(correct.root) !== key
              }
              revealed={revealed}
              onPress={() => {
                setRoot(key)
                settle({ ...current, root: key })
              }}
            />
          ))}
        </Row>
      )}

      <Row label={t('chord.keyboard.quality')}>
        {qualities.map((id) => (
          <Key
            key={id}
            label={names.chordQualityShort(id)}
            spoken={names.chordQuality(id)}
            picked={quality === id}
            right={revealed && correct?.quality === id}
            wrong={revealed && quality === id && correct?.quality !== id}
            revealed={revealed}
            onPress={() => pickQuality(id)}
          />
        ))}
      </Row>

      {rows.inversion && (
        <Row label={t('chord.keyboard.position')} muted={!needsInversion}>
          {[0, 1, 2, 3].map((member) => {
            const allowed = positions.includes(member)
            return (
              <Key
                key={member}
                label={names.inversionShort(member)}
                // The figure only once the quality has said which chord it
                // belongs to: a triad's first inversion is figured 6 and a
                // seventh chord's 6/5.
                caption={
                  quality === undefined ? undefined : inversionFigure(quality, member)
                }
                spoken={names.inversionName(member, size)}
                picked={inversion === member}
                right={revealed && correct?.inversion === member && needsInversion}
                wrong={
                  revealed &&
                  inversion === member &&
                  correct?.inversion !== member &&
                  needsInversion
                }
                revealed={revealed}
                disabled={!allowed || !needsInversion}
                onPress={() => pickInversion(member)}
              />
            )
          })}
        </Row>
      )}

      {rows.lage && (
        <Row label={t('chord.keyboard.lage')} muted={!needsLage}>
          {members.map((member) => (
            <Key
              key={member}
              label={names.lageShort(memberAt(member))}
              spoken={names.lage(memberAt(member))}
              picked={top === member}
              right={revealed && correct?.top === member}
              wrong={revealed && top === member && correct?.top !== member}
              revealed={revealed}
              disabled={member === inversion}
              onPress={() => {
                setTop(member)
                settle({ ...current, top: member })
              }}
            />
          ))}
        </Row>
      )}
    </div>
  )
}

function Row({
  label,
  muted = false,
  children,
}: {
  label: string
  muted?: boolean
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span
        className={cn(
          'px-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase',
          muted ? 'text-ink-faint/60' : 'text-ink-faint',
        )}
      >
        {label}
      </span>
      <div className="flex flex-wrap justify-center gap-1.5">{children}</div>
    </div>
  )
}

function Key({
  label,
  caption,
  spoken,
  picked,
  right,
  wrong,
  revealed,
  disabled = false,
  onPress,
}: {
  label: string
  caption?: string | undefined
  spoken: string
  picked: boolean
  right: boolean
  wrong: boolean
  revealed: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-label={spoken}
      aria-pressed={picked}
      disabled={revealed || disabled}
      onClick={onPress}
      className={answerKeyClasses(
        { showCorrect: right, showWrong: wrong, revealed },
        cn(
          'flex-col gap-0 px-3 py-1.5',
          // The pick has to be visible before the answer lands, since with
          // several rows a player fills one and then looks for the next.
          picked && !right && !wrong && 'border-accent bg-accent-tint text-accent',
          disabled && !revealed && 'opacity-35',
        ),
      )}
    >
      <span>{label}</span>
      {caption !== undefined && caption !== '' && (
        <span className="tabular text-[0.6875rem] leading-tight opacity-65">
          {caption}
        </span>
      )}
    </button>
  )
}
