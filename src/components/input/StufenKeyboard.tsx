import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { useMusicNames } from '@/hooks/useMusicNames'
import { inversionFigure } from '@/lib/music/chord'
import type { Key } from '@/lib/music/key'
import { isNumeral, numeralChoices, type Numeral } from '@/lib/music/numeral'
import { numeralText } from '@/lib/notation/harmonyNotation'
import { cn } from '@/lib/utils/cn'

import { answerKeyClasses, type KeyboardState } from './keyClasses'
import { Switch } from './Switch'

/**
 * The keyboard a progression is named on, one chord at a time.
 *
 * **Every key shows both notations**: the Stufe on top, the function under it
 * — `V7` over `D7`, `vi` over `Tp` — because the two traditions are two
 * readings of one chord, and a player fluent in either should find it at a
 * glance. Where Funktionstheorie has no agreed symbol the line is left empty,
 * as it is under the revealed setting.
 *
 * The keys are **the chords of the key**, eight in major and ten in minor,
 * where both the natural and the raised seventh degree occur: `v` and `V`,
 * `VII` and `vii°`. Then `♭II`, the Neapolitan.
 *
 * Everything else is a **switch that means the next key only**, like the
 * accidentals on the degree keyboard: `7` makes it a seventh chord, `V/` makes
 * it the dominant *of* the key pressed, and the inversion switches — only on a
 * level that asks — say which member is in the bass. **Each key draws what
 * pressing it would write**, so arming `7` turns `V · D` into `V7 · D7` and
 * arming `V/` turns `ii · Sp` into `V/ii · (D)Sp`. A key the switches make
 * meaningless — the dominant of the tonic, the Neapolitan with a seventh —
 * goes dead rather than writing something else.
 */

export interface StufenKeyboardProps {
  /** The key the progression is in, which is what the keys are named in. */
  keyOf: Key
  /** Whether the inversion switches are offered. */
  inversions: boolean
  /** Whether another chord may be written. */
  canAppend: boolean
  canRemove: boolean
  state?: KeyboardState
  onAppend: (numeral: Numeral) => void
  onRemove: () => void
}

interface Armed {
  seventh: boolean
  applied: boolean
  inversion: number
}

const NOTHING_ARMED: Armed = { seventh: false, applied: false, inversion: 0 }

export function StufenKeyboard({
  keyOf,
  inversions,
  canAppend,
  canRemove,
  state = 'answering',
  onAppend,
  onRemove,
}: StufenKeyboardProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()
  const [armed, setArmed] = useState<Armed>(NOTHING_ARMED)

  const revealed = state === 'revealed'
  const live = !revealed && canAppend
  const size = armed.seventh ? 4 : 3

  const numeralFor = useCallback(
    (choice: Numeral): Numeral | undefined => {
      const extra = {
        inversion: armed.inversion,
        ...(armed.seventh ? { seventh: true as const } : {}),
      }
      if (!armed.applied) return { ...choice, ...extra }
      // Only a chord of the key is something to be the dominant of, and the
      // plain minor variants name the same regions as their raised siblings.
      if (choice.plain === true || choice.neapolitan === true) return undefined
      return { degree: 5, of: choice.degree, ...extra }
    },
    [armed],
  )

  const press = (numeral: Numeral) => {
    if (!live) return
    onAppend(numeral)
    // The switches were for this key and nothing more.
    setArmed(NOTHING_ARMED)
  }

  const toggleInversion = (inversion: number) =>
    setArmed((current) => ({
      ...current,
      inversion: current.inversion === inversion ? 0 : inversion,
    }))

  const toggleSeventh = () =>
    setArmed((current) => ({
      ...current,
      seventh: !current.seventh,
      // A triad has no third inversion to keep.
      inversion: current.seventh && current.inversion === 3 ? 0 : current.inversion,
    }))

  return (
    <div
      role="group"
      aria-label={t('stufen.keyboard.label')}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Switch
          pressed={armed.seventh}
          disabled={!live}
          label={t('stufen.keyboard.seventh')}
          onClick={toggleSeventh}
        >
          7
        </Switch>
        <Switch
          pressed={armed.applied}
          disabled={!live}
          label={t('stufen.keyboard.applied')}
          onClick={() =>
            setArmed((current) => ({ ...current, applied: !current.applied }))
          }
        >
          V/
        </Switch>

        {inversions &&
          [1, 2, 3].map((inversion) => (
            <Switch
              key={inversion}
              pressed={armed.inversion === inversion}
              disabled={!live || inversion >= size}
              label={names.inversionName(inversion, size)}
              onClick={() => toggleInversion(inversion)}
              className="min-w-11 px-2 text-[0.8125rem]"
            >
              {inversion < size
                ? inversionFigure(armed.seventh ? 'dominant-seventh' : 'major', inversion)
                : '–'}
            </Switch>
          ))}

        <button
          type="button"
          disabled={revealed || !canRemove}
          onClick={onRemove}
          className={cn(
            'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full',
            'border border-rule bg-paper-raised text-ink-muted',
            'transition-[background-color,border-color,color,transform] duration-150',
            'hover:border-accent hover:text-accent active:scale-95',
            'disabled:cursor-default disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-muted disabled:active:scale-100',
          )}
        >
          <Icon name="backspace" size={20} label={t('stufen.keyboard.delete')} />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {numeralChoices(keyOf).map((choice) => {
          const numeral = numeralFor(choice)
          const valid = numeral !== undefined && isNumeral(keyOf, numeral)
          // What the key would write, or — where the switches make it
          // meaningless — what it names on its own, drawn faded.
          const shown = numeralText(keyOf, valid ? numeral : { ...choice, inversion: 0 })

          return (
            <button
              key={`${choice.degree}${choice.plain === true ? 'p' : ''}${choice.neapolitan === true ? 'n' : ''}`}
              type="button"
              disabled={!live || !valid}
              aria-label={
                shown.func === '' ? shown.stufe : `${shown.stufe}, ${shown.func}`
              }
              onClick={() => {
                if (valid) press(numeral)
              }}
              className={answerKeyClasses(
                { showCorrect: false, showWrong: false, revealed },
                'h-auto min-w-16 flex-col gap-0.5 px-3 py-2 disabled:opacity-35',
              )}
            >
              <span className="font-serif text-[1.0625rem] leading-tight font-semibold">
                {shown.stufe}
              </span>
              <span className="min-h-4 font-serif text-[0.875rem] leading-4 text-ink-muted">
                {shown.func}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
