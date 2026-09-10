import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NoteGlyph } from '@/components/notation/NoteGlyph'
import { Icon } from '@/components/ui/Icon'
import {
  canAppend,
  canArm,
  canRemove,
  type BarDraft,
} from '@/exercises/dictation-shared/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import { NOTE_VALUES, type NoteValue } from '@/lib/notation/rhythmNotation'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The rhythm keyboard.
 *
 * **Two rows of values — notes above, rests below — and the switches that
 * change what the next one means.**
 *
 * Rests were a switch once, like the dot still is. They are a row of their own
 * now because of how often they are wanted: a rest is not a variation on the
 * note before it, it is the other half of writing a bar down, and putting one
 * in cost two presses and left a switch down that the next note had to have
 * turned off again. Ten keys is more keys, and far fewer presses.
 *
 * The dot stays a switch, because it really is a variation: it applies to
 * whichever value comes next, note or rest, so it multiplies the rows rather
 * than adding to them. It is **one-shot** — it lets go once a value is entered,
 * so it reads as "make this one dotted" rather than as a mode to remember and
 * turn back off.
 *
 * The tuplet is neither: a bracket changes how long a value lasts, so it
 * belongs to the draft, which is the thing that knows where the beat boundaries
 * are, and it stays on until its beat is full.
 *
 * There is no submit key. The bar is answered the moment it is exactly full,
 * which is why every key that would overflow it is disabled instead.
 */

export interface RhythmKeyboardProps {
  draft: BarDraft
  /** Tuplet divisions this level offers. Empty hides the switch entirely. */
  tuplets: readonly number[]
  state?: KeyboardState
  onAppend: (value: { kind: 'note' | 'rest'; dur: NoteValue; dots: 0 | 1 }) => void
  onRemove: () => void
  onArm: (division: number | undefined) => void
}

export function RhythmKeyboard({
  draft,
  tuplets,
  state = 'answering',
  onAppend,
  onRemove,
  onArm,
}: RhythmKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [dotted, setDotted] = useState(false)

  const revealed = state === 'revealed'
  const dots = dotted ? 1 : 0

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.rhythm')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Switch
          pressed={dotted}
          disabled={revealed}
          label={t('rhythm.keyboard.dotted')}
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
          <Icon name="backspace" size={20} label={t('rhythm.keyboard.delete')} />
        </button>
      </div>

      {(['note', 'rest'] as const).map((kind) => (
        <div
          key={kind}
          role="group"
          aria-label={t(`rhythm.keyboard.${kind === 'note' ? 'notes' : 'rests'}`)}
          className="flex flex-wrap justify-center gap-1.5"
        >
          {NOTE_VALUES.map((value) => {
            const allowed = !revealed && canAppend(draft, { dur: value, dots })

            return (
              <button
                key={value}
                type="button"
                disabled={!allowed}
                aria-label={names.noteValue(value, kind, dotted)}
                onClick={() => {
                  onAppend({ kind, dur: value, dots })
                  // The dot was for the key just pressed, and nothing more.
                  setDotted(false)
                }}
                className={answerKeyClasses(
                  { showCorrect: false, showWrong: false, revealed },
                  cn(
                    'h-14 flex-1 basis-14 disabled:opacity-30',
                    !revealed && 'opacity-100',
                  ),
                )}
              >
                <NoteGlyph value={value} kind={kind} dotted={dotted} size={24} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
