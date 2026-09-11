import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { useMusicNames } from '@/hooks/useMusicNames'
import { pitch } from '@/lib/music/pitch'
import { scalePitches, tonicKey, type ModeId } from '@/lib/music/scale'
import { scaleMei } from '@/lib/notation/mei'
import { SCALE_NOTE_SPACING } from '@/lib/notation/verovio'

import { degreeShorthand, modeSummary } from './modeSeries'

/**
 * One mode, written out on the staff and spelled against the major scale.
 *
 * **All seven are shown on C**, which is the one thing that makes them
 * comparable: the tonic never moves, so the only thing that changes between
 * one staff and the next is the accidentals — which is exactly what the
 * shorthand under it names. Shown each on its own white-note tonic they would
 * all print no accidentals at all, and the page would be seven identical rows
 * of notes.
 *
 * The notes come from `scalePitches`, so they are spelled the way the exercise
 * spells them, and the staff is keyless like every scale in the app: a mode is
 * read from the accidentals in front of its notes, and under a signature
 * F♯ mixolydian looks exactly like G major.
 */

export interface ModeExampleProps {
  mode: ModeId
}

export function ModeExample({ mode }: ModeExampleProps) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const tonic = pitch('C', 0, 4)
  const pitches = scalePitches(tonic, mode)
  const summary = modeSummary(mode)

  return (
    <section className="rounded-2xl border border-rule bg-paper-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-heading">{names.mode(mode)}</h3>
        <p className="text-sm text-ink-faint">
          {t('modes.mode.degree', { degree: summary.degree })}
        </p>
      </div>

      {pitches !== undefined && (
        <Score
          className="mt-2 max-h-28"
          mei={scaleMei({ pitches, clef: 'treble' })}
          noteSpacing={SCALE_NOTE_SPACING}
          // The notes themselves, the way every scale in the app is described.
          label={t('modes.mode.staff', {
            scale: names.scaleName(tonicKey(tonic), mode),
            pitches: pitches.map((note) => names.pitchSpoken(note)).join(', '),
          })}
        />
      )}

      <ol className="mt-2 flex flex-wrap justify-center gap-1.5">
        {summary.degrees.map((degree) => {
          const altered = degree.against !== 0
          return (
            <li
              key={degree.number}
              // The altered degrees are what the mode *is*, so they carry the
              // accent and the others stay quiet. Never colour alone: the
              // sign in front of the number says it too.
              className={
                altered
                  ? 'tabular rounded-full bg-accent-tint px-2.5 py-1 text-sm font-semibold text-accent'
                  : 'tabular rounded-full px-2.5 py-1 text-sm text-ink-faint'
              }
            >
              {degreeShorthand(degree)}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
