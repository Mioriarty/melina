import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NoteGlyph } from '@/components/notation/NoteGlyph'
import { Icon } from '@/components/ui/Icon'
import { canAppend, canArm, type RhythmDraft } from '@/exercises/rhythm-dictation/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import { NOTE_VALUES, type NoteValue } from '@/lib/notation/rhythmNotation'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'

/**
 * The rhythm keyboard.
 *
 * A row of note values, and above it the three switches that change what those
 * values mean: rest, dotted, and — where a level has them — tuplet. Modes
 * rather than five times as many keys, because sixteenth through whole times
 * note-or-rest times plain-or-dotted is thirty keys, and thirty keys is a
 * form rather than an instrument.
 *
 * Rest and dotted are this component's own state: they change what the *next*
 * key means and nothing about the bar so far. **They mean exactly the next
 * key** — both switch themselves off once a value has been entered, so they
 * read as "make this one dotted" rather than as a mode that has to be
 * remembered and turned back off. Half a bar entered as rests because the
 * switch was still down is a slip that cannot happen this way.
 *
 * The tuplet is not one of them — a bracket changes how long a value lasts, so
 * it belongs to the draft, which is the thing that knows where the beat
 * boundaries are, and it stays on until its beat is full.
 *
 * There is no submit key. The bar is answered the moment it is exactly full,
 * which is why every key that would overflow it is disabled instead.
 */

export interface RhythmKeyboardProps {
  draft: RhythmDraft
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

  const [rest, setRest] = useState(false)
  const [dotted, setDotted] = useState(false)

  const revealed = state === 'revealed'
  const kind = rest ? 'rest' : 'note'
  const dots = dotted ? 1 : 0

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.rhythm')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Switch
          pressed={rest}
          disabled={revealed}
          label={t('rhythm.keyboard.rest')}
          onClick={() => setRest((current) => !current)}
        >
          <NoteGlyph value={4} kind="rest" dotted={dotted} size={20} />
        </Switch>

        <Switch
          pressed={dotted}
          disabled={revealed}
          label={t('rhythm.keyboard.dotted')}
          onClick={() => setDotted((current) => !current)}
        >
          <NoteGlyph value={4} kind={kind} dotted size={20} />
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
          disabled={revealed || draft.entries.length === 0}
          onClick={onRemove}
          className={cn(
            'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full',
            'border border-rule bg-paper-raised text-ink-muted transition-colors',
            'hover:border-accent hover:text-accent',
            'disabled:cursor-default disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-muted',
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

interface SwitchProps {
  pressed: boolean
  disabled: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}

function Switch({ pressed, disabled, label, onClick, children }: SwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3',
        'transition-[background-color,border-color,color] duration-150',
        pressed
          ? 'border-accent bg-accent-tint text-accent'
          : 'border-rule bg-paper-raised text-ink-muted hover:border-accent hover:text-accent',
        'disabled:cursor-default disabled:opacity-40',
      )}
    >
      {children}
    </button>
  )
}
