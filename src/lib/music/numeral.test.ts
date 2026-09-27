import { describe, expect, it } from 'vitest'

import { createRandom } from '@/lib/utils/seededRandom'
import { numeralText } from '@/lib/notation/harmonyNotation'

import { buildEvents, eventStufe, stufeFunction } from './harmony'
import { KEY_CHOICES, parseKeyKey, type Key } from './key'
import {
  bassNoteEvents,
  isNumeral,
  namesChord,
  numeralChoices,
  numeralOf,
  numeralSpec,
  progressionNumerals,
  typeableNumerals,
  type Numeral,
} from './numeral'
import { DEFAULT_METER, generateProgression, type Progression } from './progression'
import { BLOCKS } from './satzmodell'

/**
 * Naming a chord the way a player does.
 *
 * The property everything rests on: **every chord the generator can produce
 * has a name on the keyboard.** Without it, Stufen dictation would ask a
 * question with no right answer to press — and nothing about the types would
 * notice. It is asserted over every key and every block, the way
 * `catalog.test.ts` holds hearable intervals to a property rather than a list.
 */

const key = (text: string): Key => parseKeyKey(text) as Key
const C = key('C:ionian')
const A_MINOR = key('A:aeolian')

function progressions(): Progression[] {
  const cadences = BLOCKS.filter((block) => block.kind === 'cadence').map((b) => b.id)
  const blocks = BLOCKS.filter(
    (block) => block.kind !== 'cadence' && block.kind !== 'opening',
  ).map((b) => b.id)

  const found: Progression[] = []
  for (const choice of KEY_CHOICES) {
    for (const seed of [1, 2, 3, 4]) {
      const progression = generateProgression(createRandom(seed), {
        keys: [choice],
        chords: [6, 8],
        cadences,
        blocks,
        freeWeight: 1,
        meter: DEFAULT_METER,
      })
      if (progression !== undefined) found.push(progression)
    }
  }
  return found
}

const ALL = progressions()

describe('every chord the generator makes has a name', () => {
  it('has progressions to check', () => {
    expect(ALL.length).toBeGreaterThan(KEY_CHOICES.length * 2)
  })

  it.each([false, true])('with inversions asked: %s', (withInversion) => {
    for (const progression of ALL) {
      const numerals = progressionNumerals(
        progression.key,
        progression.events,
        withInversion,
      )
      const where = `${progression.key.tonic.letter}${progression.key.tonic.alteration} ${progression.key.mode}: ${progression.analysis.map((a) => a.id).join(' ')}`
      expect(numerals, where).toBeDefined()
    }
  })

  it('names each chord by the chord it spells', () => {
    // The round trip: the name found for a chord names that chord.
    for (const progression of ALL) {
      for (const event of bassNoteEvents(progression.events)) {
        const numeral = numeralOf(progression.key, event, true)
        expect(numeral).toBeDefined()
        if (numeral === undefined) continue
        expect(namesChord(progression.key, numeral, event, true)).toBe(true)
      }
    }
  })
})

describe('a suspension is named by what it resolves to', () => {
  it('reads the cadential six-four as the dominant', () => {
    const events = buildEvents(C, { degree: 5, inversion: 0, suspend: [6, 4], beats: 4 })
    expect(events).toHaveLength(2)
    const [chord] = bassNoteEvents(events ?? [])
    expect(numeralOf(C, chord as never, true)).toEqual({ degree: 5, inversion: 0 })
  })
})

describe('grading is by sound', () => {
  const heard = (spec: Numeral, of: Key = C) => {
    const [event] = buildEvents(of, numeralSpec(spec)) ?? []
    expect(event).toBeDefined()
    return event as NonNullable<typeof event>
  }

  it('accepts either reading of one chord', () => {
    // VII7 in natural minor *is* the dominant seventh of III.
    const seventh = heard(
      { degree: 7, plain: true, seventh: true, inversion: 0 },
      A_MINOR,
    )
    expect(
      namesChord(
        A_MINOR,
        { degree: 5, of: 3, seventh: true, inversion: 0 },
        seventh,
        true,
      ),
    ).toBe(true)
    expect(
      namesChord(
        A_MINOR,
        { degree: 7, plain: true, seventh: true, inversion: 0 },
        seventh,
        true,
      ),
    ).toBe(true)
  })

  it('tells a triad from its seventh chord, and v from V', () => {
    const dominant = heard({ degree: 5, inversion: 0 })
    expect(
      namesChord(C, { degree: 5, seventh: true, inversion: 0 }, dominant, false),
    ).toBe(false)

    const minorV = heard({ degree: 5, plain: true, inversion: 0 }, A_MINOR)
    expect(namesChord(A_MINOR, { degree: 5, inversion: 0 }, minorV, false)).toBe(false)
    expect(
      namesChord(A_MINOR, { degree: 5, plain: true, inversion: 0 }, minorV, false),
    ).toBe(true)
  })

  it('grades the inversion only where it is asked', () => {
    const six = heard({ degree: 1, inversion: 1 })
    expect(namesChord(C, { degree: 1, inversion: 0 }, six, false)).toBe(true)
    expect(namesChord(C, { degree: 1, inversion: 0 }, six, true)).toBe(false)
    expect(namesChord(C, { degree: 1, inversion: 1 }, six, true)).toBe(true)
  })
})

describe('what can be named', () => {
  it('offers eight keys in major and ten in minor', () => {
    expect(numeralChoices(C)).toHaveLength(8)
    expect(numeralChoices(A_MINOR)).toHaveLength(10)
  })

  it('has no dominant of the tonic and none of a diminished chord', () => {
    expect(isNumeral(C, { degree: 5, of: 1, inversion: 0 })).toBe(false)
    expect(isNumeral(C, { degree: 5, of: 7, inversion: 0 })).toBe(false)
    expect(isNumeral(C, { degree: 5, of: 2, inversion: 0 })).toBe(true)
  })

  it('never lists one name twice', () => {
    for (const choice of KEY_CHOICES) {
      const keys = typeableNumerals(choice).map((numeral) => JSON.stringify(numeral))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe('printing a name in both notations', () => {
  const text = (numeral: Numeral, of: Key = C) => numeralText(of, numeral)

  it('prints the diatonic chords of a major key', () => {
    expect(text({ degree: 1, inversion: 0 })).toEqual({ stufe: 'I', func: 'T' })
    expect(text({ degree: 2, inversion: 0 })).toEqual({ stufe: 'ii', func: 'Sp' })
    expect(text({ degree: 6, inversion: 0 })).toEqual({ stufe: 'vi', func: 'Tp' })
    expect(text({ degree: 5, seventh: true, inversion: 0 })).toEqual({
      stufe: 'V7',
      func: 'D7',
    })
    expect(text({ degree: 5, seventh: true, inversion: 1 }).stufe).toBe('V6/5')
  })

  it('prints both dominants of a minor key', () => {
    expect(text({ degree: 5, plain: true, inversion: 0 }, A_MINOR)).toEqual({
      stufe: 'v',
      func: 'd',
    })
    expect(text({ degree: 5, inversion: 0 }, A_MINOR)).toEqual({ stufe: 'V', func: 'D' })
    expect(text({ degree: 1, inversion: 0 }, A_MINOR)).toEqual({ stufe: 'i', func: 't' })
  })

  it('prints applied dominants and the Neapolitan', () => {
    expect(text({ degree: 5, of: 5, seventh: true, inversion: 0 })).toEqual({
      stufe: 'V7/V',
      func: 'DD7',
    })
    expect(text({ degree: 5, of: 2, seventh: true, inversion: 0 })).toEqual({
      stufe: 'V7/ii',
      func: '(D7)Sp',
    })
    expect(text({ degree: 2, neapolitan: true, inversion: 1 })).toEqual({
      stufe: '♭II6',
      func: 'sN',
    })
  })

  it("reads the scale's own seventh chords as the triad's function with a seventh", () => {
    expect(text({ degree: 2, seventh: true, inversion: 0 })).toEqual({
      stufe: 'ii7',
      func: 'Sp7',
    })
    expect(text({ degree: 4, seventh: true, inversion: 0 }, A_MINOR).func).toBe('s7')
    expect(
      text({ degree: 7, plain: true, seventh: true, inversion: 0 }, A_MINOR).func,
    ).toBe('dP7')
  })

  it('never reads a borrowed seventh as the triad it is built on', () => {
    // A dominant seventh on the first degree of C is the dominant of F — its
    // B♭ is borrowed — and calling it T7 would name the wrong function.
    const [event] =
      buildEvents(C, {
        degree: 1,
        quality: 'dominant-seventh',
        seventh: true,
        inversion: 0,
        beats: 1,
      }) ?? []
    const stufe = event === undefined ? undefined : eventStufe(C, event)
    expect(stufe).toBeDefined()
    expect(stufeFunction(C, stufe as NonNullable<typeof stufe>)).toBeUndefined()
    expect(text({ degree: 5, of: 4, seventh: true, inversion: 0 }).func).toBe('(D7)S')
  })

  it('prints what the analysis under a setting prints', () => {
    // One reading, so a key and the row under the reveal cannot disagree.
    for (const numeral of typeableNumerals(C)) {
      if (numeral.of !== undefined) continue
      const [event] = buildEvents(C, numeralSpec(numeral)) ?? []
      const stufe = event === undefined ? undefined : eventStufe(C, event)
      expect(stufe).toBeDefined()
    }
  })
})
