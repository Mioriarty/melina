import { describe, expect, it } from 'vitest'

import { createRandom } from '@/lib/utils/seededRandom'

import { chromaticValue } from './pitch'
import { KEY_CHOICES } from './key'
import {
  DEFAULT_METER,
  generateProgression,
  type Progression,
  type ProgressionSpec,
} from './progression'
import { satzChord, satzLine, voiceProgression } from './satb'
import { BLOCKS } from './satzmodell'
import { errorsOf, satzFindings, SATB_RANGES, VOICES, type Satz } from './voiceLeading'

const CADENCES = BLOCKS.filter((block) => block.kind === 'cadence').map(
  (block) => block.id,
)
const MIDDLE = BLOCKS.filter(
  (block) => block.kind !== 'cadence' && block.kind !== 'opening',
).map((block) => block.id)

const EVERYTHING: ProgressionSpec = {
  keys: KEY_CHOICES,
  chords: [5, 6, 7, 8],
  cadences: CADENCES,
  blocks: MIDDLE,
  freeWeight: 1,
  meter: DEFAULT_METER,
}

/** All schema and no walk, which is where the awkward voice leading lives. */
const SCHEMAS: ProgressionSpec = { ...EVERYTHING, freeWeight: 0 }

/** All walk and no schema — the backwards Markov chain on its own. */
const WALK: ProgressionSpec = { ...EVERYTHING, blocks: [], freeWeight: 1 }

function settings(
  spec: ProgressionSpec,
  count: number,
  seed = 1,
): readonly [Progression, Satz][] {
  const random = createRandom(seed)
  const found: [Progression, Satz][] = []

  for (let index = 0; index < count; index += 1) {
    const progression = generateProgression(random, spec)
    expect(progression, `progression ${index}`).toBeDefined()
    if (progression === undefined) continue

    const satz = voiceProgression(progression, { constraints: progression.constraints })
    expect(satz, `setting ${index} of ${progression.events.length} chords`).toBeDefined()
    if (satz !== undefined) found.push([progression, satz])
  }

  return found
}

/**
 * Voicing a few hundred progressions is seconds of work, and it earns them —
 * this is the block the whole design rests on. The timeout sits on the
 * describe rather than on one test so that no case here is left on the default
 * five seconds, which is close enough to what these actually cost that a
 * slower machine under load would fail them for being slow rather than wrong.
 */
describe('voiceProgression', { timeout: 60_000 }, () => {
  /**
   * **The test this whole design exists for.** `voiceLeading.ts` is written
   * once and read twice — as the filter the search generates through, and as
   * the grader a four-part writing exercise will be marked by. Running the
   * grader over what the generator produced is the same move `modeOf` makes on
   * the scale generator and `readChord` on the chord one: the generator is
   * checked against the model rather than trusted.
   */
  it('sets every progression without breaking a single rule', () => {
    for (const spec of [EVERYTHING, SCHEMAS, WALK]) {
      for (const [progression, satz] of settings(spec, 40)) {
        const faults = errorsOf(satzFindings(satz))
        expect(
          faults.map((fault) => `${fault.id}@${fault.at} (${fault.voices.join('+')})`),
          progression.analysis.map((span) => span.id).join(' → '),
        ).toEqual([])
      }
    }
  })

  it('keeps every voice inside its own compass', () => {
    for (const [, satz] of settings(EVERYTHING, 25)) {
      for (const voice of VOICES) {
        const range = SATB_RANGES[voice]
        for (const note of satzLine(satz, voice)) {
          expect(chromaticValue(note)).toBeGreaterThanOrEqual(
            chromaticValue(range.lowest),
          )
          expect(chromaticValue(note)).toBeLessThanOrEqual(chromaticValue(range.highest))
        }
      }
    }
  })

  it('sings the bass the progression named, in every chord', () => {
    for (const [progression, satz] of settings(EVERYTHING, 25)) {
      for (const [index, event] of progression.events.entries()) {
        expect(satz.voicings[index]?.bass.letter).toBe(event.bass.letter)
        expect(satz.voicings[index]?.bass.alteration).toBe(event.bass.alteration)
      }
    }
  })

  it('holds the bass still under a suspension', () => {
    // `held` is the one thing flattening a suspension into two events would
    // otherwise lose, and the setting has to honour it or the bass restrikes.
    let seen = 0
    for (const [progression, satz] of settings(EVERYTHING, 35)) {
      for (const [index, event] of progression.events.entries()) {
        if (event.held !== true || index === 0) continue
        seen += 1
        expect(chromaticValue(satz.voicings[index]?.bass as never)).toBe(
          chromaticValue(satz.voicings[index - 1]?.bass as never),
        )
      }
    }
    expect(seen, 'no suspension ever came up').toBeGreaterThan(0)
  })

  it('stacks a chord from the bass upward', () => {
    for (const [, satz] of settings(EVERYTHING, 20)) {
      for (let index = 0; index < satz.events.length; index += 1) {
        const chord = satzChord(satz, index)
        expect(chord).toHaveLength(4)
        for (let voice = 1; voice < chord.length; voice += 1) {
          expect(chromaticValue(chord[voice] as never)).toBeGreaterThanOrEqual(
            chromaticValue(chord[voice - 1] as never),
          )
        }
      }
    }
  })

  it('puts the soprano where a cadence asks for it', () => {
    let seen = 0
    for (const [progression, satz] of settings(EVERYTHING, 35)) {
      for (const constraint of progression.constraints) {
        seen += 1
        expect(satz.voicings[constraint.event]?.soprano.letter).toBe(
          constraint.soprano.letter,
        )
      }
    }
    expect(seen, 'no cadence ever named a Lage').toBeGreaterThan(0)
  })
})
