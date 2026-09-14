import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MiniStaff } from '@/components/notation/MiniStaff'
import { Icon } from '@/components/ui/Icon'
import {
  canRemove,
  currentSlot,
  isFull,
  place,
  placedPitch,
  type SatzDraft,
} from '@/exercises/satb-entry/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import { alterationInKey, type KeySignatureId } from '@/lib/music/keySignature'
import { isAlteration, LETTERS, type Letter } from '@/lib/music/pitch'
import { tonicKey, type PitchClass } from '@/lib/music/scale'
import { VOICE_PARTS } from '@/lib/notation/satbMei'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The four-part keyboard — the realising keyboard, taught about voices.
 *
 * Seven letters spelled by `alterationInKey`, exactly as `ChordKeyboard` does,
 * because a four-part setting is read as notes in a key and not as degrees of
 * one. What is new is that a press belongs to a **voice**, and two things
 * follow from that.
 *
 * **The key draws the note on the voice's own staff, with the voice's own
 * stem.** Soprano and tenor are the upper part of their staff and take stems
 * up; alto and bass are the lower and take stems down — `VOICE_PARTS` says so
 * once, and `satbMei` engraves from the same table, so a key cannot come to
 * look unlike the note it puts down. The stem is a loose signal rather than a
 * precise one, since it only halves the four, so the voice is also named beside
 * the switches; between them there is never a moment where the player has to
 * work out whose note they are writing.
 *
 * **The octave is the app's to choose, so it has a switch.** Seven keys cannot
 * name a pitch, and the rule `placedPitch` uses — follow this voice from the
 * chord before, open near the middle of its compass — is right almost every
 * time and not always. A voice's compass never spans two octaves, so a letter
 * names two pitches at most: one one-shot switch reaches *the other octave* and
 * is never ambiguous. Without it the tenor could never open wide of the bass
 * and no spacing could ever be wrong, which would quietly delete half of what
 * the exercise is about.
 *
 * Everything a switch does is visible before it is spent, because each key
 * draws the note that pressing it would actually write — the rule
 * `ChordKeyboard` already lives by. An armed switch with nowhere to go simply
 * leaves the key showing what it will really put down.
 *
 * There is **no confirm key**: a setting is exactly fillable, so the press that
 * fills the last voice of the last chord is the press that answers.
 */

export interface SatbKeyboardProps {
  draft: SatzDraft
  keySignature: KeySignatureId
  /** Whether a note may be raised or lowered out of the key. */
  alterations: boolean
  state?: KeyboardState
  onChange: (draft: SatzDraft) => void
  onRemove: () => void
}

export function SatbKeyboard({
  draft,
  keySignature,
  alterations,
  state = 'answering',
  onChange,
  onRemove,
}: SatbKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [shift, setShift] = useState<-1 | 0 | 1>(0)
  const [octave, setOctave] = useState(false)

  const revealed = state === 'revealed'
  const full = isFull(draft)
  const live = !revealed && !full
  const canAlter = alterations && live

  const slot = currentSlot(draft)
  // Once everything is written the row goes on showing the voice it was last
  // asked about, rather than emptying and resizing under the hand that just
  // pressed it.
  const voice = slot?.voice ?? draft.order[draft.order.length - 1] ?? 'soprano'
  const part = VOICE_PARTS[voice]
  const clef = part.staff === 1 ? 'treble' : 'bass'

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
      if (note === undefined) return
      const placed = placedPitch(draft, note, octave)
      if (placed === undefined) return

      onChange(place(draft, placed))
      // Both switches were for this key and nothing more.
      setShift(0)
      setOctave(false)
    },
    [draft, live, noteFor, octave, onChange],
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
        setShift((current) => (current === 1 ? 0 : 1))
        return
      }
      if (event.key === '-' || event.key === '_') {
        if (!canAlter) return
        event.preventDefault()
        setShift((current) => (current === -1 ? 0 : -1))
        return
      }
      // The one key past the seven letters, which is what it does.
      if (event.key === '8') {
        if (!live) return
        event.preventDefault()
        setOctave((current) => !current)
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
  }, [canAlter, draft, live, onRemove, pressLetter, revealed])

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.satb')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span aria-live="polite" className="mr-1 text-sm font-medium text-ink-muted">
          {names.voice(voice)}
        </span>

        {alterations && (
          <>
            <Switch
              pressed={shift > 0}
              disabled={!canAlter}
              label={t('satb.keyboard.sharp')}
              hint="+"
              onClick={() => setShift((current) => (current === 1 ? 0 : 1))}
            >
              ♯
            </Switch>
            <Switch
              pressed={shift < 0}
              disabled={!canAlter}
              label={t('satb.keyboard.flat')}
              hint="−"
              onClick={() => setShift((current) => (current === -1 ? 0 : -1))}
            >
              ♭
            </Switch>
          </>
        )}

        <Switch
          pressed={octave}
          disabled={!live}
          label={t('satb.keyboard.octave')}
          hint="8"
          onClick={() => setOctave((current) => !current)}
        >
          8ᵛᵃ
        </Switch>

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
          <Icon name="backspace" size={20} label={t('satb.keyboard.delete')} />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {LETTERS.map((letter) => {
          const note = noteFor(letter)
          const pitch = note === undefined ? undefined : placedPitch(draft, note, octave)

          return (
            <button
              key={letter}
              type="button"
              disabled={!live || pitch === undefined}
              aria-label={
                pitch === undefined
                  ? letter
                  : t('satb.keyboard.press', {
                      note: names.pitchSpoken(pitch),
                      voice: names.voice(voice),
                    })
              }
              onClick={() => pressLetter(letter)}
              className={answerKeyClasses(
                { showCorrect: false, showWrong: false, revealed },
                'h-auto min-w-14 flex-col gap-1.5 px-2.5 py-2.5 disabled:opacity-35',
              )}
            >
              {pitch !== undefined && (
                <MiniStaff
                  pitch={pitch}
                  clef={clef}
                  keySignature={keySignature}
                  stem={part.stem}
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
