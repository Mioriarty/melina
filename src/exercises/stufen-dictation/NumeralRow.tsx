import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import type { Key } from '@/lib/music/key'
import type { Numeral } from '@/lib/music/numeral'
import { numeralText } from '@/lib/notation/harmonyNotation'
import { cn } from '@/lib/utils/cn'

export interface NumeralRowProps {
  keyOf: Key
  /** How many chords the progression has, which is how many slots to draw. */
  length: number
  /** What has been named so far. */
  written: readonly Numeral[]
  /** Slot by slot, once the answer is in. */
  verdicts?: readonly boolean[]
}

/**
 * The chords named so far, one slot per bass note, under the staff.
 *
 * **Every slot is drawn from the start**, empty ones as a faint dash, so the
 * player can see how many chords there are to name and the row never grows
 * under their hands. Its height is reserved for two lines whatever is in it,
 * the way the play caption under a staff reserves its own.
 *
 * Once the answer is in, a slot says whether it was right — by colour, by an
 * icon and by an outline on a miss, never by colour alone — and the analysis
 * rows under the revealed staff say what it should have been.
 */
export function NumeralRow({ keyOf, length, written, verdicts }: NumeralRowProps) {
  const { t } = useTranslation('exercise')

  return (
    <ol
      aria-label={t('stufen.answerLabel')}
      className="flex min-h-[4.75rem] w-full max-w-lg shrink-0 flex-wrap content-start justify-center gap-1.5"
    >
      {Array.from({ length }, (_, index) => {
        const numeral = written[index]
        const verdict = verdicts?.[index]
        const text = numeral === undefined ? undefined : numeralText(keyOf, numeral)

        return (
          <li
            key={index}
            className={cn(
              'flex h-9 min-w-10 items-center justify-center gap-1 rounded-lg px-2',
              'font-serif text-[0.9375rem] font-semibold whitespace-nowrap',
              numeral === undefined && 'border border-dashed border-rule text-ink-faint',
              numeral !== undefined &&
                verdict === undefined &&
                'bg-accent-tint text-accent',
              verdict === true && 'bg-correct/12 text-correct',
              verdict === false &&
                'bg-wrong/12 text-wrong ring-1 ring-wrong/45 ring-inset',
            )}
          >
            {text === undefined ? (
              <span aria-hidden>–</span>
            ) : (
              <>
                {verdict !== undefined && (
                  <Icon name={verdict ? 'correct' : 'wrong'} size={13} />
                )}
                <span>{text.stufe}</span>
                <span className="sr-only">
                  {text.func === '' ? '' : `, ${text.func}`}
                  {verdict === undefined
                    ? ''
                    : `, ${t(verdict ? 'stufen.slot.correct' : 'stufen.slot.wrong')}`}
                </span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
