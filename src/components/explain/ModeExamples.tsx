import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PlayableExample } from '@/components/explain/PlayableExample'
import { Score } from '@/components/notation/Score'
import { useMusicNames } from '@/hooks/useMusicNames'
import { playScale } from '@/lib/audio/engine'
import { pitch } from '@/lib/music/pitch'
import { scalePitches, tonicKey, type ModeId } from '@/lib/music/scale'
import { scaleMei } from '@/lib/notation/mei'
import { SCALE_NOTE_SPACING } from '@/lib/notation/verovio'

import { degreeShorthand, modeSummary } from './modeSeries'

/**
 * One scale, written out on the staff and spelled against the major scale.
 *
 * **All nine are shown on C**, which is the one thing that makes them
 * comparable: the tonic never moves, so the only thing that changes between
 * one staff and the next is the accidentals — which is exactly what the
 * shorthand under it names. Shown each on its own white-note tonic the seven
 * modes would all print no accidentals at all, and the page would be seven
 * identical rows of notes.
 *
 * The notes come from `scalePitches`, so they are spelled the way the exercise
 * spells them, and the staff is keyless like every scale in the app: a mode is
 * read from the accidentals in front of its notes, and under a signature
 * F♯ mixolydian looks exactly like G major.
 *
 * **Every staff is pressable**, because what a mode *is* is a sound, and a
 * page that only prints one is asking to be taken on trust. Ascending, which
 * is how a scale is heard here and the only direction melodic minor has.
 */

/**
 * The one tonic every mode is drawn on — a module constant rather than a value
 * built per render, so the notes derived from it keep their identity and the
 * playback hook is not told the sound has changed on every render.
 */
const TONIC = pitch('C', 0, 4)

export interface ModeExampleProps {
  mode: ModeId
}

export function ModeExample({ mode }: ModeExampleProps) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const pitches = useMemo(() => scalePitches(TONIC, mode), [mode])
  const summary = modeSummary(mode)

  // Stable across renders, which is what `usePlayback` hangs its silence on:
  // a closure rebuilt every render reads as the sound having changed, and the
  // hook would silence what it had just started.
  const sound = useCallback(() => playScale(pitches ?? []), [pitches])

  // The notes themselves, the way every scale in the app is described. Read
  // twice — by the staff and by the button around it — so it is named once.
  const staffLabel = t('modes.mode.staff', {
    scale: names.scaleName(tonicKey(TONIC), mode),
    pitches: (pitches ?? []).map((note) => names.pitchSpoken(note)).join(', '),
  })

  return (
    <section className="rounded-2xl border border-rule bg-paper-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-heading">{names.mode(mode)}</h3>
        <p className="text-sm text-ink-faint">
          {/* Harmonic and melodic minor begin on no degree of a major scale,
              because they are not rotations of one. The caption says that
              where the others say which degree. */}
          {summary.degree === undefined
            ? t('modes.mode.altered')
            : t('modes.mode.degree', { degree: summary.degree })}
        </p>
      </div>

      {pitches !== undefined && (
        <PlayableExample
          sound={sound}
          label={staffLabel}
          // The staff's own classes, so the button adds no geometry: a block
          // filling the card, exactly as the score did on its own.
          className="mt-2 block w-full"
        >
          <Score
            className="max-h-28"
            mei={scaleMei({ pitches, clef: 'treble' })}
            noteSpacing={SCALE_NOTE_SPACING}
            label={staffLabel}
          />
        </PlayableExample>
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
