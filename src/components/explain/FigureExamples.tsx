import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { describeEvent, parseWanted } from '@/exercises/thoroughbass-shared/generate'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { parsePitch } from '@/lib/music/pitch'
import { figureText } from '@/lib/notation/figureNotation'
import { thoroughbassMei } from '@/lib/notation/mei'
import { THOROUGHBASS_EXAMPLE_PROFILE } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

/**
 * Engraved examples for the figured bass guide.
 *
 * **Every example is the model evaluated, not a picture drawn to match it** —
 * the notes over each bass come from `figurePitches` and are placed by
 * `voiceChord`, the same two functions the exercises grade against. A guide
 * that describes a model has to be able to go stale; this one cannot, and if
 * the conventions change the page changes with them.
 *
 * The one thing written by hand is which bass and key each figure is *shown*
 * over, which is an illustration rather than a rule.
 *
 * The event itself comes from `describeEvent`, the same function the generator
 * assembles a question with — so where the notes sit, and how many chords a
 * bass note carries, are the exercise's own answers rather than a second set
 * kept in step by hand.
 */

export interface FigureExampleProps {
  /** A pitch key, `G3`. */
  bass: string
  /**
   * A figure key, `6/5`. Empty is an unfigured bass, and a dash makes it a
   * suspension — `4-3` is two figures under the one held bass note, drawn as
   * one staff with the chord moving over it, exactly as a question is.
   */
  figure: string
  keySignature?: KeySignatureId
  /**
   * Whether to draw the chord. **Off is what the page actually prints**, and
   * showing the two side by side is the whole point of the comparison: a
   * continuo part is the left-hand picture, and the player supplies the right.
   */
  sounding?: boolean
  caption?: string
  className?: string
}

export function FigureExample({
  bass,
  figure,
  keySignature = '0',
  sounding = false,
  caption,
  className,
}: FigureExampleProps) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  const root = parsePitch(bass)
  const figures = parseWanted(figure)
  const event =
    root === undefined || figures === undefined
      ? undefined
      : describeEvent(root, keySignature, figures)

  if (root === undefined || figures === undefined || event === undefined) return null

  // Off is what the page actually prints: the bass and its figures, with the
  // staff above still empty.
  const chords = sounding ? event.chords : event.chords.map(() => [])
  const printed = figures.map(figureText).join(' – ')

  return (
    <figure className={cn('m-0 grid justify-items-center gap-2', className)}>
      {/*
        The height has to come down the box, not up from the drawing. `Score`
        puts `max-h-full` on the SVG, and against a parent whose height is
        indefinite that resolves to nothing — the staff then sizes the box that
        was supposed to size it and prints straight over the caption. So the
        wrapper carries a definite height and `items-stretch` hands it on, the
        same chain `SCORE_BOX` sets up on a round screen.
      */}
      <div className="flex h-56 w-full items-stretch justify-center sm:h-64">
        <Score
          className="h-full min-h-0 flex-1"
          mei={thoroughbassMei({
            keySignature,
            events: [{ bass: root, figures, chords }],
          })}
          profile={THOROUGHBASS_EXAMPLE_PROFILE}
          label={t('figures.exampleLabel', {
            bass: names.pitchSpoken(root),
            figure: printed === '' ? t('figures.none') : printed,
            key: names.keyMajor(keySignature),
          })}
        />
      </div>
      {caption !== undefined && (
        <figcaption className="text-center text-sm leading-snug text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/**
 * The same bass twice: what the page prints, and what the player makes of it.
 *
 * The single most useful picture in the whole guide, because the gap between
 * the two *is* what a figured bass is.
 */
export interface FigurePairProps {
  bass: string
  figure: string
  keySignature?: KeySignatureId
  /** Overrides the default "printed" / "played" captions where a section wants its own. */
  writtenCaption?: string
  playedCaption?: string
}

export function FigurePair({
  bass,
  figure,
  keySignature = '0',
  writtenCaption,
  playedCaption,
}: FigurePairProps) {
  const { t } = useTranslation('guide')

  return (
    <div className="mt-2 grid gap-5 rounded-2xl border border-rule bg-paper-raised p-4 sm:grid-cols-2 sm:gap-4">
      <FigureExample
        bass={bass}
        figure={figure}
        keySignature={keySignature}
        caption={writtenCaption ?? t('figures.printed')}
      />
      <FigureExample
        bass={bass}
        figure={figure}
        keySignature={keySignature}
        sounding
        caption={playedCaption ?? t('figures.played')}
      />
    </div>
  )
}

/** Two examples side by side, for a comparison the captions carry. */
export function FigureRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 grid gap-5 rounded-2xl border border-rule bg-paper-raised p-4 sm:grid-cols-2 sm:gap-4">
      {children}
    </div>
  )
}
