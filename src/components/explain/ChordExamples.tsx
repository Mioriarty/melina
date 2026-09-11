import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { useMusicNames } from '@/hooks/useMusicNames'
import {
  chordPitches,
  chordSize,
  closeChord,
  inversionFigure,
  memberAt,
  type Chord,
  type ChordQuality,
} from '@/lib/music/chord'
import { parseTonicKey, tonicKey } from '@/lib/music/scale'
import { chordMei } from '@/lib/notation/mei'
import { cn } from '@/lib/utils/cn'

import { chordSummary } from './chordSeries'
import { degreeShorthand } from './modeSeries'

/**
 * Engraved examples for the chords guide.
 *
 * **Every staff is the model evaluated, not a picture drawn to match it.** The
 * notes come from `chordNotes` and are placed by `voiceChord`, which are the
 * two functions the exercises grade against — so turning a constant moves the
 * page with it, and the guide cannot come to describe something the app no
 * longer does. The same rule `FigureExamples` and `ModeExamples` follow.
 *
 * The one thing written by hand is which root each example is *shown* on,
 * which is an illustration rather than a rule — see `pages/chordExamples.ts`.
 */

/** The staff on its own, with the spoken description a screen reader gets. */
function ChordStaff({ chord, className }: { chord: Chord; className?: string }) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const pitches = chordPitches(chord)
  if (pitches === undefined) return null

  return (
    <Score
      className={cn('max-h-32', className)}
      mei={chordMei({ pitches, clef: 'treble' })}
      label={t('chords.staff', {
        chord: names.chordName(tonicKey(chord.root), chord.quality),
        pitches: pitches.map((note) => names.pitchSpoken(note)).join(', '),
      })}
    />
  )
}

export interface ChordExampleProps {
  quality: ChordQuality
  /** A tonic key, `C`. Eight of the nine spell cleanly on C; one does not. */
  root: string
}

/**
 * One quality, written out and spelled two ways.
 *
 * Against the major scale — `1 ♭3 ♭5 ♭♭7`, the same shorthand the modes guide
 * writes and the same function writing it — and as **the thirds it is stacked
 * from**, which is the definition you can build and hear rather than read.
 * Both come from `chordSummary`, which measures the chord's own notes.
 */
export function ChordExample({ quality, root }: ChordExampleProps) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const tonic = parseTonicKey(root)
  if (tonic === undefined) return null

  const summary = chordSummary(quality)

  return (
    <section className="rounded-2xl border border-rule bg-paper-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-heading">{names.chordQuality(quality)}</h3>
        <p className="text-sm text-ink-faint">
          {summary.thirds.map((third) => names.interval(third)).join(t('chords.plus'))}
        </p>
      </div>

      <ChordStaff chord={closeChord(tonic, quality)} className="mt-2" />

      <ol className="mt-2 flex flex-wrap justify-center gap-1.5">
        {summary.degrees.map((degree) => (
          <li
            key={degree.number}
            // The altered members are what the quality *is*, so they carry the
            // accent and the plain ones stay quiet. Never colour alone: the
            // sign in front of the number says it too.
            className={
              degree.against !== 0
                ? 'tabular rounded-full bg-accent-tint px-2.5 py-1 text-sm font-semibold text-accent'
                : 'tabular rounded-full px-2.5 py-1 text-sm text-ink-faint'
            }
          >
            {degreeShorthand(degree)}
          </li>
        ))}
      </ol>
    </section>
  )
}

export interface ChordPositionProps {
  root: string
  quality: ChordQuality
  inversion: number
  /** Omitted for the close-position stacking, which is what an inversion shows. */
  top?: number
  /** Name it by its Lage rather than by its inversion. */
  by?: 'inversion' | 'lage'
}

/**
 * One chord, standing one way.
 *
 * The same card serves both halves of the page, because they are the same fact
 * seen from two ends: an inversion is which member is lowest and a Lage is
 * which is highest, and nothing else about the chord changes between them.
 */
export function ChordPosition({
  root,
  quality,
  inversion,
  top,
  by = 'inversion',
}: ChordPositionProps) {
  const names = useMusicNames()

  const tonic = parseTonicKey(root)
  if (tonic === undefined) return null

  const base = closeChord(tonic, quality, inversion)
  const chord: Chord = top === undefined ? base : { ...base, top }

  return (
    <figure className="rounded-2xl border border-rule bg-paper-raised p-4">
      <ChordStaff chord={chord} />
      <figcaption className="mt-2 text-center">
        <span className="block text-sm font-semibold text-ink">
          {by === 'lage'
            ? names.lage(memberAt(chord.top))
            : names.inversionName(inversion, chordSize(quality))}
        </span>
        <span className="tabular mt-0.5 block text-sm text-ink-faint">
          {by === 'lage'
            ? names.inversionName(inversion, chordSize(quality))
            : inversionFigure(quality, inversion)}
        </span>
      </figcaption>
    </figure>
  )
}
