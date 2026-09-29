import { describe, expect, it } from 'vitest'

import {
  cadenceSpec,
  correctedSetting,
  generateCadenceRound,
  type CadenceQuestion,
} from '@/exercises/harmony-shared/generate'
import { chromaticValue } from '@/lib/music/pitch'
import { VOICES, type Voicing } from '@/lib/music/satbVoicing'
import { createRandom } from '@/lib/utils/seededRandom'

import { CADENCE_DIFFICULTIES } from './difficulties'
import { isCadenceCorrect } from './rules'

/**
 * Showing a correct setting after a wrong one.
 *
 * A cadence has many right settings, so the one shown is the player's own,
 * **mended**: the voicing search run again with their setting as the thing to
 * stay near. Two properties make that worth showing, and both are checked
 * against the real grader rather than trusted:
 *
 * - it is **right** — marked correct by exactly the verdict the player got, in
 *   every level, whatever was written;
 * - it is **near** — it never changes more notes than the question's own
 *   setting would have, so what differs is what had to.
 */

const ROUNDS: readonly CadenceQuestion[] = CADENCE_DIFFICULTIES.flatMap((level) =>
  generateCadenceRound(createRandom(29), cadenceSpec(level.settings)).slice(0, 4),
)

/** How many notes two settings disagree on. */
function changed(a: readonly Voicing[], b: readonly Voicing[]): number {
  let count = 0
  a.forEach((voicing, index) => {
    const other = b[index]
    for (const voice of VOICES) {
      if (
        other === undefined ||
        chromaticValue(voicing[voice]) !== chromaticValue(other[voice]) ||
        voicing[voice].letter !== other[voice].letter
      ) {
        count += 1
      }
    }
  })
  return count
}

/** Wrong answers of the kinds a player writes: a voice moved, voices swapped. */
function mistakes(question: CadenceQuestion): readonly (readonly Voicing[])[] {
  const model = question.model.voicings
  const shift = (by: number) =>
    model.map((voicing, index) =>
      index === 1
        ? {
            ...voicing,
            alto: { ...voicing.alto, octave: voicing.alto.octave + by },
          }
        : voicing,
    )
  // The upper voices all doubled onto the tenor's note: the wrong chord, spaced
  // wrongly, and parallels everywhere.
  const smeared = model.map((voicing) => ({
    ...voicing,
    alto: voicing.tenor,
    soprano: voicing.tenor,
  }))
  const crossed = model.map((voicing) => ({
    ...voicing,
    alto: voicing.soprano,
    soprano: voicing.alto,
  }))
  return [shift(1), shift(-1), smeared, crossed]
}

describe('a corrected setting', () => {
  it('has questions from every level to correct', () => {
    expect(ROUNDS.length).toBeGreaterThanOrEqual(CADENCE_DIFFICULTIES.length)
  })

  it('is always marked correct by the verdict the player got', () => {
    for (const question of ROUNDS) {
      for (const wrong of mistakes(question)) {
        const fixed = correctedSetting(question, wrong)
        expect(isCadenceCorrect(fixed.voicings, question)).toBe(true)
      }
    }
  })

  it('changes no more notes than the model answer would have', () => {
    for (const question of ROUNDS) {
      for (const wrong of mistakes(question)) {
        const fixed = correctedSetting(question, wrong)
        expect(changed(fixed.voicings, wrong)).toBeLessThanOrEqual(
          changed(question.model.voicings, wrong),
        )
      }
    }
  })

  it('keeps the given bass', () => {
    for (const question of ROUNDS) {
      const [wrong] = mistakes(question)
      const fixed = correctedSetting(question, wrong ?? [])
      expect(fixed.voicings.map((voicing) => voicing.bass)).toEqual(
        question.model.voicings.map((voicing) => voicing.bass),
      )
    }
  })

  it('leaves a setting the search itself would write alone', () => {
    for (const question of ROUNDS) {
      const fixed = correctedSetting(question, question.model.voicings)
      expect(changed(fixed.voicings, question.model.voicings)).toBe(0)
    }
  })

  it('mends a single moved note by moving it back, not by rewriting', () => {
    // One alto an octave out is one note wrong; the mended setting should
    // differ from the player's in very few places, not re-voice the cadence.
    for (const question of ROUNDS) {
      const [octaveUp] = mistakes(question)
      if (octaveUp === undefined) continue
      const fixed = correctedSetting(question, octaveUp)
      expect(changed(fixed.voicings, octaveUp)).toBeLessThanOrEqual(2)
    }
  })
})
