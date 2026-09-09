import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MiniStaff } from '@/components/notation/MiniStaff'
import { Icon } from '@/components/ui/Icon'
import { canAppend, type DegreeDraft } from '@/exercises/scale-degrees/draft'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ClefId } from '@/lib/music/clef'
import { degreePitch, type Degree, type DegreeAlteration } from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import type { ModeId } from '@/lib/music/scale'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'

/**
 * The scale degree keyboard.
 *
 * One key per degree, each showing **the note it means** over its number. The
 * note is the whole reason the key is worth drawing: a degree is an abstraction
 * until you can see where it sits, and the same "3" is a different place on the
 * staff in every key. The staves carry no clef and no signature — the staff
 * above already has both — so a key that agrees with the key signature is a
 * plain notehead and only an altered one prints an accidental.
 *
 * The two accidental switches are **one-shot**, like the rest and dot switches
 * on the rhythm keyboard: they mean the next key, not a mode to remember and
 * turn back off. They are absent entirely on a level that stays in the key.
 */

export interface DegreeKeyboardProps {
  draft: DegreeDraft
  /** The degree numbers this level offers, in order. */
  numbers: readonly number[]
  /** The key the melody is in, which is what the notes on the keys are drawn from. */
  tonic: Pitch
  mode: ModeId
  clef: ClefId
  keySignature: KeySignatureId
  /** Whether a note may be raised or lowered out of the key. */
  alterations: boolean
  state?: KeyboardState
  onAppend: (degree: Degree) => void
  onRemove: () => void
}

export function DegreeKeyboard({
  draft,
  numbers,
  tonic,
  mode,
  clef,
  keySignature,
  alterations,
  state = 'answering',
  onAppend,
  onRemove,
}: DegreeKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [alteration, setAlteration] = useState<DegreeAlteration>(0)

  const revealed = state === 'revealed'
  const full = !canAppend(draft)

  const toggle = (next: DegreeAlteration) =>
    setAlteration((current) => (current === next ? 0 : next))

  return (
    <div
      role="group"
      aria-label={t('round.keyboardLabel.degree')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {alterations && (
          <>
            <Switch
              pressed={alteration === 1}
              disabled={revealed || full}
              label={t('degrees.keyboard.sharp')}
              onClick={() => toggle(1)}
            >
              ♯
            </Switch>
            <Switch
              pressed={alteration === -1}
              disabled={revealed || full}
              label={t('degrees.keyboard.flat')}
              onClick={() => toggle(-1)}
            >
              ♭
            </Switch>
          </>
        )}

        <button
          type="button"
          disabled={revealed || draft.degrees.length === 0}
          onClick={onRemove}
          className={cn(
            'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full',
            'border border-rule bg-paper-raised text-ink-muted transition-colors',
            'hover:border-accent hover:text-accent',
            'disabled:cursor-default disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-muted',
          )}
        >
          <Icon name="backspace" size={20} label={t('degrees.keyboard.delete')} />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {numbers.map((number) => {
          const degree: Degree = { number, alteration }
          const pitch = degreePitch(tonic, mode, degree)
          // A degree whose altered form would need a triple accidental cannot
          // be written, so its key goes dead rather than lying about it.
          const allowed = !revealed && !full && pitch !== undefined

          return (
            <button
              key={number}
              type="button"
              disabled={!allowed}
              aria-label={names.degree(degree)}
              onClick={() => {
                onAppend(degree)
                // The switch was for this key and nothing more.
                setAlteration(0)
              }}
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
                  className="h-12"
                />
              )}
              <span className="text-[0.8125rem] font-semibold">
                {names.degreeShort(degree)}
              </span>
            </button>
          )
        })}
      </div>
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
        'text-[1.0625rem] transition-[background-color,border-color,color] duration-150',
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
