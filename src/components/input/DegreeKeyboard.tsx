import { useCallback, useEffect, useState } from 'react'
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
 *
 * On a desktop the whole thing can be typed: **1 to 7** enter a degree, **+**
 * and **-** raise and lower the next one, and backspace takes one back. The
 * number is already printed on the key, so the shortcut is the label — there is
 * nothing extra to learn or to put on screen.
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
  /** Whether an accidental can be asked for at all, here and now. */
  const canAlter = alterations && !revealed && !full

  const toggle = useCallback(
    (next: DegreeAlteration) => setAlteration((current) => (current === next ? 0 : next)),
    [],
  )

  /** One path for a mouse and for the keyboard, so the two cannot drift. */
  const press = useCallback(
    (number: number) => {
      if (revealed || full) return
      const degree: Degree = { number, alteration }
      // A degree whose altered form would need a triple accidental cannot be
      // written, so it is not enterable either way.
      if (degreePitch(tonic, mode, degree) === undefined) return

      onAppend(degree)
      // The switch was for this key and nothing more.
      setAlteration(0)
    },
    [alteration, full, mode, onAppend, revealed, tonic],
  )

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
        if (revealed || draft.degrees.length === 0) return
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
      if (Number.isInteger(number) && numbers.includes(number)) {
        event.preventDefault()
        press(number)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canAlter, draft.degrees.length, numbers, onRemove, press, revealed, toggle])

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
              disabled={!canAlter}
              label={t('degrees.keyboard.sharp')}
              hint="+"
              onClick={() => toggle(1)}
            >
              ♯
            </Switch>
            <Switch
              pressed={alteration === -1}
              disabled={!canAlter}
              label={t('degrees.keyboard.flat')}
              hint="−"
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
              onClick={() => press(number)}
              className={answerKeyClasses(
                { showCorrect: false, showWrong: false, revealed },
                'h-auto min-w-16 flex-col gap-1.5 px-3 py-2.5 disabled:opacity-35',
              )}
            >
              {pitch !== undefined && (
                <MiniStaff
                  pitch={pitch}
                  clef={clef}
                  keySignature={keySignature}
                  className="h-14 sm:h-16"
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
  /** The key that does the same thing, for a mouse pointer to discover. */
  hint: string
  onClick: () => void
  children: React.ReactNode
}

function Switch({ pressed, disabled, label, hint, onClick, children }: SwitchProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={`${label} (${hint})`}
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
