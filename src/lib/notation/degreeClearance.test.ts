// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { getClef, CLEFS, type ClefId } from '@/lib/music/clef'
import { DEGREE_NUMBERS, degreePitch, keySignatureFor } from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { comparePitch, pitchKey, type Pitch } from '@/lib/music/pitch'
import { MODE_IDS, TONIC_CHOICES, fittingOctaves, isCleanScale } from '@/lib/music/scale'

import { measureInk } from '@/test/svgInk'

import { degreeKeyMei, melodyMei } from './mei'
import { DEGREE_KEY_PROFILE, melodyProfile, renderMei } from './verovio'

/**
 * Nothing a degree can be written as may run off its page.
 *
 * This exists because reasoning about it failed. An earlier version sized both
 * pages by reading the y of each glyph's `<use transform="translate(...)">` —
 * which is the glyph's *anchor*, and says nothing about how far its ink spreads
 * from there. A notehead two ledger lines below the staff sat comfortably
 * inside the page by that measure and was sliced in half on screen. A minor and
 * A major both reach it, so it was not an exotic case either.
 *
 * So this measures the **drawing** — every glyph outline is embedded in the
 * SVG's own `<defs>`, which makes the extent of the notation exactly
 * computable. An earlier version rasterised instead, and that was worse than
 * it looked: Verovio writes staff labels as `<text font-family="Times, serif">`,
 * so the picture depended on which fonts the machine had, and the check passed
 * on a laptop and failed on a Linux runner. See `test/svgInk.ts`.
 */

/** The smallest gap between the ink and the edge of the page it is drawn on. */
function clearance(svg: string): number {
  return measureInk(svg).clearance
}

/** The lowest and highest note any degree can reach, per clef. */
function extremes(clefId: ClefId): { lowest: Pitch; highest: Pitch } {
  const clef = getClef(clefId)
  let lowest: Pitch | undefined
  let highest: Pitch | undefined

  for (const tonic of TONIC_CHOICES) {
    for (const mode of MODE_IDS) {
      if (!isCleanScale(tonic, mode)) continue

      for (const octave of fittingOctaves(tonic, mode, clef.lowest, clef.highest)) {
        const root = { ...tonic, octave }
        if (keySignatureFor(root, mode) === undefined) continue

        for (const number of DEGREE_NUMBERS) {
          for (const alteration of [-1, 0, 1] as const) {
            const pitch = degreePitch(root, mode, { number, alteration })
            if (pitch === undefined) continue
            if (lowest === undefined || comparePitch(pitch, lowest) < 0) lowest = pitch
            if (highest === undefined || comparePitch(pitch, highest) > 0) highest = pitch
          }
        }
      }
    }
  }

  return { lowest: lowest as Pitch, highest: highest as Pitch }
}

/** The widest signatures, since they push the music furthest right. */
const SIGNATURES: readonly KeySignatureId[] = ['0', '7s', '7f']

describe('the extremes a degree can reach', () => {
  it('names A3 in the treble, two ledger lines below the staff', () => {
    // The case that was being cut in half, and the reason this file exists.
    // A minor and A major both put a tonic there.
    const { lowest } = extremes('treble')
    expect(
      comparePitch(lowest, { letter: 'A', alteration: 0, octave: 3 }),
    ).toBeLessThanOrEqual(0)
  })

  it.each(CLEFS.map((clef) => clef.id))(
    'fits on a key in the %s clef',
    async (clefId) => {
      const { lowest, highest } = extremes(clefId)

      for (const pitch of [lowest, highest]) {
        for (const keySignature of SIGNATURES) {
          const svg = await renderMei(
            degreeKeyMei({ pitch, clef: clefId, keySignature }),
            undefined,
            DEGREE_KEY_PROFILE,
          )
          expect(
            await clearance(svg),
            `${clefId} ${pitchKey(pitch)} under ${keySignature}`,
          ).toBeGreaterThan(0)
        }
      }
    },
  )

  it.each(CLEFS.map((clef) => clef.id))(
    'fits on the staff in the %s clef',
    async (clefId) => {
      const { lowest, highest } = extremes(clefId)

      for (const pitch of [lowest, highest]) {
        for (const keySignature of SIGNATURES) {
          const melody = [pitch, pitch, pitch, pitch]

          for (const staves of [1, 2] as const) {
            const svg = await renderMei(
              melodyMei({
                clef: clefId,
                keySignature,
                slots: melody.length,
                staves:
                  staves === 1
                    ? [{ pitches: melody }]
                    : [
                        { pitches: melody, label: 'You' },
                        { pitches: melody, label: 'Correct' },
                      ],
              }),
              undefined,
              melodyProfile(melody.length, staves),
            )
            expect(
              await clearance(svg),
              `${clefId} ${pitchKey(pitch)} under ${keySignature}, ${staves} staves`,
            ).toBeGreaterThan(0)
          }
        }
      }
    },
  )
})
