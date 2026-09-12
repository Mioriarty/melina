import type { ChordQuality } from '@/lib/music/chord'

/**
 * Which root each example on the chords guide is drawn on.
 *
 * **Data rather than markup, and that is not tidiness.** A guide that teaches
 * "a chord is a stack of thirds spelled from its root" and then draws one the
 * exercises would refuse to generate is worse than no guide, and nothing about
 * the types would say so — so `ChordsPage.test.ts` holds every example here to
 * `isCleanChord`, which is the same bar a question has to clear.
 *
 * **All nine stand on C**, which is what makes them comparable: the root never
 * moves, so the only difference from one staff to the next is the accidentals
 * — exactly the reason the modes guide draws every scale on C.
 *
 * That includes the diminished seventh, whose seventh above C is B double
 * flat. Drawing it somewhere more comfortable would have been drawing around
 * the thing itself: a double accidental is what a stack of thirds produces
 * there, it is how the chord is written, and the guide says so.
 */
export interface ChordExampleDef {
  quality: ChordQuality
  root: string
}

export const TRIAD_EXAMPLES: readonly ChordExampleDef[] = [
  { quality: 'major', root: 'C' },
  { quality: 'minor', root: 'C' },
  { quality: 'diminished', root: 'C' },
  { quality: 'augmented', root: 'C' },
]

export const SEVENTH_EXAMPLES: readonly ChordExampleDef[] = [
  { quality: 'dominant-seventh', root: 'C' },
  { quality: 'major-seventh', root: 'C' },
  { quality: 'minor-seventh', root: 'C' },
  { quality: 'half-diminished-seventh', root: 'C' },
  { quality: 'diminished-seventh', root: 'C' },
]

export const CHORD_EXAMPLES: readonly ChordExampleDef[] = [
  ...TRIAD_EXAMPLES,
  ...SEVENTH_EXAMPLES,
]

/**
 * The chord the inversion and Lage sections are shown on.
 *
 * A plain major triad, because those two sections are about *where the members
 * stand* and a quality with accidentals in it would give the eye something else
 * to read at the same time.
 */
export const POSITION_EXAMPLE = { quality: 'major' as const, root: 'C' }

/** And the seventh chord, which has one inversion more than a triad has. */
export const SEVENTH_POSITION_EXAMPLE = {
  quality: 'dominant-seventh' as const,
  root: 'G',
}
