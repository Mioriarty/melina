// @vitest-environment node
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { getClef, CLEFS, type ClefId } from '@/lib/music/clef'
import { DEGREE_NUMBERS, degreePitch, keySignatureFor } from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { comparePitch, pitchKey, type Pitch } from '@/lib/music/pitch'
import { MODE_IDS, TONIC_CHOICES, fittingOctaves, isCleanScale } from '@/lib/music/scale'

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
 * So this measures **pixels**: it rasterises the extremes and insists on clear
 * space on every side. Slow, and worth it — it is the only check here that
 * looks at what is actually drawn rather than at what the markup says.
 */

/** The smallest gap between the ink and any edge, in pixels. */
async function clearance(svg: string): Promise<number> {
  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let top = info.height
  let bottom = -1
  let left = info.width
  let right = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[y * info.width + x] ?? 255) >= 250) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }

  if (bottom === -1) throw new Error('nothing was drawn')
  return Math.min(top, info.height - 1 - bottom, left, info.width - 1 - right)
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
