import type { KeySignatureId } from '@/lib/music/keySignature'

/**
 * Every engraved example on the figured bass guide.
 *
 * A sibling module rather than exports from the page itself, so React Fast
 * Refresh keeps working — the same split as `ui/Button.tsx` and
 * `ui/buttonClasses.ts`.
 *
 * They are data rather than JSX literals for one reason: **the guide may never
 * print a figure the exercise would mark wrong.** A page that teaches "a figure
 * writes only what is not obvious" and then draws `♭5/3` — with a 3 that the
 * rule it just stated says not to write — is worse than no page, and nothing
 * about the types would say so. `FiguredBassPage.test.tsx` holds every one of
 * these to `canonicalFigures`.
 */
export interface GuideExample {
  /** A pitch key, `E3`. */
  bass: string
  /** A figure key, `6/5`. Empty is an unfigured bass. */
  figure: string
  keySignature: KeySignatureId
}

export const GUIDE_EXAMPLES = {
  /** The page and the playing: one bass, printed and then realised. */
  printedPlayed: { bass: 'E3', figure: '6', keySignature: '0' },

  /** The same figure counted from two different basses. */
  overC: { bass: 'C3', figure: '6', keySignature: '0' },
  overE: { bass: 'E3', figure: '6', keySignature: '0' },

  /** The same figure over the same bass, in two different keys. */
  inC: { bass: 'D3', figure: '6', keySignature: '0' },
  inF: { bass: 'D3', figure: '6', keySignature: '1f' },

  /** What the shorthand leaves out. */
  unfigured: { bass: 'C3', figure: '', keySignature: '0' },
  seventh: { bass: 'G3', figure: '7', keySignature: '0' },

  /** A third, and the same third raised by a sign standing on its own. */
  plainThird: { bass: 'E3', figure: '', keySignature: '0' },
  raisedThird: { bass: 'E3', figure: '#3', keySignature: '0' },

  /**
   * Grove's own worked example. Figured `♭5` and not `♭5/3`: the third is
   * taken for granted here exactly as it is everywhere else, which is the
   * point the section above it has just made.
   */
  groveFifth: { bass: 'Eb3', figure: 'b5', keySignature: '1s' },
} satisfies Record<string, GuideExample>
