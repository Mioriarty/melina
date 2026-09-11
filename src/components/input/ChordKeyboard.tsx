import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MiniStaff } from '@/components/notation/MiniStaff'
import { Icon } from '@/components/ui/Icon'
import {
  canPlace,
  canRemove,
  isFull,
  place,
  placedPitch,
  type ChordDraft,
} from '@/exercises/thoroughbass-realizing/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import { alterationInKey, type KeySignatureId } from '@/lib/music/keySignature'
import { isAlteration, LETTERS, type Letter } from '@/lib/music/pitch'
import { tonicKey, type PitchClass } from '@/lib/music/scale'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The realising keyboard — one key per note of the key, each drawing the note
 * it means.
 *
 * Structurally the scale degree keyboard, and for the same reason: a note name
 * is an abstraction until you can see where it sits. What differs is what the
 * keys are drawn *from*. There is no mode here and no tonic, only a key
 * signature and a bass, so the seven letters are spelled by `alterationInKey`
 * and the two switches shift from there — which means this keyboard needs no
 * scale-degree machinery at all.
 *
 * Labels are note names rather than degree numbers, because a figured bass is
 * read as intervals above its bass and not as degrees of a key. They go through
 * `useMusicNames`, since the note English calls B is H in German.
 *
 * **Each key draws the note that pressing it would write, octave and all.**
 * What you see is what you get: the row is a preview of the chord being built,
 * so the second note of a close-position chord is drawn above the first and
 * the resolution of a suspension is drawn where the resolution goes. It comes
 * from `placedPitch`, which runs the same `voiceChords` the staff does over
 * the draft the press would produce — one answer to where a note sits, never
 * two that could disagree.
 *
 * So the faces climb as a chord fills, and a chord that has to be moved bodily
 * to fit the staff takes the row with it. That is the cost of the principle
 * and it is worth paying: a key that says `C` when what arrives is a `C` an
 * octave higher is a key that has to be learnt rather than read.
 *
 * The keys themselves never move — seven letters in seven places — and only
 * what is drawn on them changes. A note already in the chord shows where it
 * already sits, which is the only true thing such a key can say.
 *
 * There is **no confirm key**: the chord is exactly fillable, every key that
 * would overfill is disabled, and the last press left is the one that completes
 * it. A note already in the chord is disabled too, because the answer is the
 * set of distinct notes above the bass and a repeat can never be right.
 */

export interface ChordKeyboardProps {
  draft: ChordDraft
  keySignature: KeySignatureId
  /** Whether a note may be raised or lowered out of the key. */
  alterations: boolean
  state?: KeyboardState
  onChange: (draft: ChordDraft) => void
  onRemove: () => void
}

export function ChordKeyboard({
  draft,
  keySignature,
  alterations,
  state = 'answering',
  onChange,
  onRemove,
}: ChordKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [shift, setShift] = useState<-1 | 0 | 1>(0)

  const revealed = state === 'revealed'
  const full = isFull(draft)
  const live = !revealed && !full
  const canAlter = alterations && live

  const toggle = useCallback(
    (next: -1 | 1) => setShift((current) => (current === next ? 0 : next)),
    [],
  )

  /** The note a key stands for, once the armed accidental is taken into account. */
  const noteFor = useCallback(
    (letter: Letter): PitchClass | undefined => {
      const alteration = alterationInKey(letter, keySignature) + shift
      return isAlteration(alteration) ? { letter, alteration } : undefined
    },
    [keySignature, shift],
  )

  const pressLetter = useCallback(
    (letter: Letter) => {
      if (!live) return
      const note = noteFor(letter)
      if (note === undefined || !canPlace(draft, note)) return
      onChange(place(draft, note))
      // The switch was for this key and nothing more.
      setShift(0)
    },
    [draft, live, noteFor, onChange],
  )

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
        if (revealed || !canRemove(draft)) return
        event.preventDefault()
        onRemove()
        return
      }
      // `=` because a plain keyboard needs a shift for `+`, and asking for one
      // to raise a note would make the shortcut slower than the button.
      if (event.key === '+' || event.key === '=') {
        if (!canAlter) return
        event.preventDefault()
        toggle(1)
        return
      }
      if (event.key === '-' || event.key === '_') {
        if (!canAlter) return
        event.preventDefault()
        toggle(-1)
        return
      }

      const index = Number(event.key)
      if (Number.isInteger(index) && index >= 1 && index <= 7) {
        event.preventDefault()
        pressLetter(LETTERS[index - 1] as Letter)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canAlter, draft, onRemove, pressLetter, revealed, toggle])

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.chord')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {alterations && (
          <>
            <Switch
              pressed={shift === 1}
              disabled={!canAlter}
              label={t('realizing.keyboard.sharp')}
              hint="+"
              onClick={() => toggle(1)}
            >
              ♯
            </Switch>
            <Switch
              pressed={shift === -1}
              disabled={!canAlter}
              label={t('realizing.keyboard.flat')}
              hint="−"
              onClick={() => toggle(-1)}
            >
              ♭
            </Switch>
          </>
        )}

        <button
          type="button"
          disabled={revealed || !canRemove(draft)}
          onClick={onRemove}
          className={cn(
            'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full',
            'border border-rule bg-paper-raised text-ink-muted transition-colors',
            'hover:border-accent hover:text-accent',
            'disabled:cursor-default disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-muted',
          )}
        >
          <Icon name="backspace" size={20} label={t('realizing.keyboard.delete')} />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {LETTERS.map((letter) => {
          const note = noteFor(letter)
          const allowed = live && note !== undefined && canPlace(draft, note)
          const pitch = note === undefined ? undefined : placedPitch(draft, note)

          return (
            <button
              key={letter}
              type="button"
              disabled={!allowed}
              aria-label={pitch === undefined ? letter : names.pitchSpoken(pitch)}
              onClick={() => pressLetter(letter)}
              className={answerKeyClasses(
                { showCorrect: false, showWrong: false, revealed },
                'h-auto min-w-16 flex-col gap-1.5 px-3 py-2.5 disabled:opacity-35',
              )}
            >
              {pitch !== undefined && (
                <MiniStaff
                  pitch={pitch}
                  clef="treble"
                  keySignature={keySignature}
                  className="h-14 sm:h-16"
                />
              )}
              <span className="text-[0.8125rem] font-semibold">
                {note === undefined ? letter : names.tonic(tonicKey(note))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
