import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MiniStaff } from '@/components/notation/MiniStaff'
import { NoteGlyph } from '@/components/notation/NoteGlyph'
import { Icon } from '@/components/ui/Icon'
import {
  canAppend,
  canArm,
  canRemove,
  type BarDraft,
} from '@/exercises/dictation-shared/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ClefId } from '@/lib/music/clef'
import { degreePitch, type Degree, type DegreeAlteration } from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import type { ModeId } from '@/lib/music/scale'
import { NOTE_VALUES, type NoteValue } from '@/lib/notation/rhythmNotation'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The melody keyboard — the two dictation keyboards at once.
 *
 * Three rows, and the middle one is what makes writing a melody one press per
 * note rather than two:
 *
 * 1. **Switches**, which mean the next key only: the two accidentals, the dot,
 *    and the tuplet brackets the level offers. Backspace sits at the right, as
 *    it does on every other keyboard here.
 * 2. **The note value**, which is a mode that *stays*. A melody is mostly one
 *    value at a time — a bar of eighths is eight presses of the same length —
 *    so a value that let go after every note would double the work of writing
 *    anything down.
 * 3. **The notes**, one key per scale step in the level's range, plus a rest.
 *
 * **Each pitch key draws the note that pressing it would write**, at the value
 * and dots currently armed: arm a dotted half and the keys become dotted
 * halves. That is what makes the middle row legible without reading it — the
 * mode is visible in the thing it modifies rather than only in the switch that
 * set it.
 *
 * **The armed value falls back rather than going dead.** Three beats into a
 * bar of four with a half note armed, nothing on the bottom row could be
 * pressed; instead the largest value that does fit is used for this press, and
 * the player's own choice comes back the moment there is room for it again. A
 * keyboard where every key is grey and nothing says why is the worst of the
 * available behaviours.
 *
 * On a desktop the notes can be typed: **1 to 7** enter a degree in the
 * tonic's own octave, **+** and **-** raise and lower the next one, and
 * backspace takes one back. Keys above or below that octave are reached with a
 * pointer — the number is the label, and one number cannot mean two keys.
 */

export interface MelodyKeyboardProps {
  draft: BarDraft
  /** The steps this level offers, low to high. One key each. */
  steps: readonly Degree[]
  /** The key the melody is in, which the notes on the keys are drawn from. */
  tonic: Pitch
  mode: ModeId
  clef: ClefId
  keySignature: KeySignatureId
  /** Whether a note may be raised or lowered out of the key. */
  alterations: boolean
  /** Tuplet divisions this level offers. Empty hides the switches entirely. */
  tuplets: readonly number[]
  state?: KeyboardState
  onAppend: (value: {
    kind: 'note' | 'rest'
    dur: NoteValue
    dots: 0 | 1
    pitch?: Pitch
  }) => void
  onRemove: () => void
  onArm: (division: number | undefined) => void
}

/** Largest first, so the fallback fills as much of the bar as it can. */
const LARGEST_FIRST = [...NOTE_VALUES].reverse()

export function MelodyKeyboard({
  draft,
  steps,
  tonic,
  mode,
  clef,
  keySignature,
  alterations,
  tuplets,
  state = 'answering',
  onAppend,
  onRemove,
  onArm,
}: MelodyKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [value, setValue] = useState<NoteValue>(4)
  const [dotted, setDotted] = useState(false)
  const [alteration, setAlteration] = useState<DegreeAlteration>(0)

  const revealed = state === 'revealed'

  const fits = useCallback(
    (dur: NoteValue, dots: 0 | 1) => canAppend(draft, { dur, dots }),
    [draft],
  )

  // What the next key will actually write. The player's choice when there is
  // room for it, and otherwise the largest value there is room for — see the
  // note above about a keyboard with nothing pressable on it.
  const armedDots: 0 | 1 = dotted && fits(value, 1) ? 1 : 0
  const armedValue = fits(value, armedDots)
    ? value
    : (LARGEST_FIRST.find((dur) => fits(dur, armedDots)) ?? value)

  const writable = fits(armedValue, armedDots)
  const canWrite = !revealed && writable

  const toggle = useCallback(
    (next: DegreeAlteration) => setAlteration((current) => (current === next ? 0 : next)),
    [],
  )

  /** One path for a pointer and for the keyboard, so the two cannot drift. */
  const press = useCallback(
    (step: Degree) => {
      if (!canWrite) return

      const degree: Degree = { ...step, alteration }
      const pitch = degreePitch(tonic, mode, degree)
      // A degree whose altered form would need a triple accidental cannot be
      // written, so it is not enterable either way.
      if (pitch === undefined) return

      onAppend({ kind: 'note', dur: armedValue, dots: armedDots, pitch })
      // The switches were for this key and nothing more.
      setAlteration(0)
      setDotted(false)
    },
    [alteration, armedDots, armedValue, canWrite, mode, onAppend, tonic],
  )

  const canAlter = alterations && canWrite

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Leave shortcuts, and anything being typed into a field, alone.
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

      const number = Number(event.key)
      if (!Number.isInteger(number)) return

      // The tonic's own octave, since the number printed on the key is the
      // shortcut and one number cannot stand for two keys.
      const step = steps.find(
        (candidate) => candidate.number === number && (candidate.octave ?? 0) === 0,
      )
      if (step === undefined) return

      event.preventDefault()
      press(step)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canAlter, draft, onRemove, press, revealed, steps, toggle])

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.melody')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {alterations && (
          <>
            <Switch
              pressed={alteration === 1}
              disabled={!canAlter}
              label={t('melody.keyboard.sharp')}
              hint="+"
              onClick={() => toggle(1)}
            >
              ♯
            </Switch>
            <Switch
              pressed={alteration === -1}
              disabled={!canAlter}
              label={t('melody.keyboard.flat')}
              hint="−"
              onClick={() => toggle(-1)}
            >
              ♭
            </Switch>
          </>
        )}

        <Switch
          pressed={dotted}
          disabled={revealed || !fits(armedValue, 1)}
          label={t('melody.keyboard.dotted')}
          onClick={() => setDotted((current) => !current)}
        >
          <NoteGlyph value={4} kind="note" dotted size={20} />
        </Switch>

        {tuplets.map((division) => (
          <Switch
            key={division}
            pressed={draft.tuplet === division}
            // A bracket can only open on an untouched beat, so the switch goes
            // dead in the middle of one rather than silently doing nothing.
            disabled={revealed || (draft.tuplet !== division && !canArm(draft))}
            label={names.tuplet(division)}
            onClick={() => onArm(draft.tuplet === division ? undefined : division)}
          >
            <span className="text-[0.9375rem] font-semibold">{division}</span>
          </Switch>
        ))}

        <button
          type="button"
          disabled={revealed || !canRemove(draft)}
          onClick={onRemove}
          className={cn(
            'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full',
            'border border-rule bg-paper-raised text-ink-muted',
            'transition-[background-color,border-color,color,transform] duration-150',
            'hover:border-accent hover:text-accent active:scale-95',
            'disabled:cursor-default disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-muted disabled:active:scale-100',
          )}
        >
          <Icon name="backspace" size={20} label={t('melody.keyboard.delete')} />
        </button>
      </div>

      {/*
        The one mode that stays down. A melody is mostly one value at a time,
        so this is set once and then left alone while the notes are entered.
      */}
      <div
        role="group"
        aria-label={t('melody.keyboard.values')}
        className="flex flex-wrap justify-center gap-1.5"
      >
        {NOTE_VALUES.map((dur) => (
          <Switch
            key={dur}
            pressed={armedValue === dur}
            disabled={revealed || !fits(dur, armedDots)}
            label={names.noteValue(dur, 'note', armedDots === 1)}
            onClick={() => setValue(dur)}
            className="px-4"
          >
            <NoteGlyph value={dur} kind="note" dotted={armedDots === 1} size={22} />
          </Switch>
        ))}
      </div>

      <div
        role="group"
        aria-label={t('melody.keyboard.notes')}
        className="flex flex-wrap justify-center gap-1.5"
      >
        {steps.map((step) => {
          const degree: Degree = { ...step, alteration }
          const pitch = degreePitch(tonic, mode, degree)
          // A degree whose altered form would need a triple accidental cannot
          // be written, so its key goes dead rather than lying about it.
          const allowed = canWrite && pitch !== undefined

          return (
            <button
              key={`${step.number}:${step.octave ?? 0}`}
              type="button"
              disabled={!allowed}
              aria-label={names.degree(degree)}
              onClick={() => press(step)}
              className={answerKeyClasses(
                { showCorrect: false, showWrong: false, revealed },
                'h-auto min-w-14 flex-col gap-1 px-2.5 py-2 disabled:opacity-35',
              )}
            >
              {pitch !== undefined && (
                <MiniStaff
                  pitch={pitch}
                  clef={clef}
                  keySignature={keySignature}
                  dur={armedValue}
                  dots={armedDots}
                  className="h-12 sm:h-14"
                />
              )}
              <span className="text-[0.8125rem] font-semibold">
                {names.degreeShort(degree)}
              </span>
            </button>
          )
        })}

        {/*
          The rest, beside the notes rather than on a row of its own: it is one
          of the things that can be written at the armed value, and it is
          reached far less often than any note.
        */}
        <button
          type="button"
          disabled={!canWrite}
          aria-label={names.noteValue(armedValue, 'rest', armedDots === 1)}
          onClick={() => {
            if (!canWrite) return
            onAppend({ kind: 'rest', dur: armedValue, dots: armedDots })
            setAlteration(0)
            setDotted(false)
          }}
          className={answerKeyClasses(
            { showCorrect: false, showWrong: false, revealed },
            'h-auto min-w-14 flex-col gap-1 px-2.5 py-2 disabled:opacity-35',
          )}
        >
          <span className="grid h-12 place-items-center sm:h-14">
            <NoteGlyph
              value={armedValue}
              kind="rest"
              dotted={armedDots === 1}
              size={26}
            />
          </span>
          <span className="text-[0.8125rem] font-semibold">
            {t('melody.keyboard.rest')}
          </span>
        </button>
      </div>
    </div>
  )
}
