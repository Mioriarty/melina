import { describe, expect, it } from 'vitest'

import { getClef } from '@/lib/music/clef'
import {
  chromaticValue,
  diatonicValue,
  pitch,
  pitchKey,
  type Letter,
} from '@/lib/music/pitch'
import type { PitchClass } from '@/lib/music/scale'

import { DEFAULT_REGISTER, OPENING_OCTAVE, voiceChord, voiceChords } from './voicing'

/**
 * Where a chord sits.
 *
 * A figure says which notes and never where they sit, so none of this is ever
 * graded — which is exactly why it needs holding to something. Nothing about
 * the types would notice a suspension resolving by a leap of an octave, and
 * that is what it did.
 */
const pc = (letter: string, alteration = 0): PitchClass => ({
  letter: letter as Letter,
  alteration: alteration as PitchClass['alteration'],
})

const spell = (chord: readonly ReturnType<typeof pitch>[]) => chord.map(pitchKey)

/** The lowest note of a first chord, which is what its register comes down to. */
const opensOn = (notes: readonly PitchClass[]) => voiceChord(notes)[0]

describe('a chord on its own', () => {
  it('opens in one octave whatever its letters', () => {
    // **The register used to depend on which letter happened to be lowest.** A
    // triad over G sat a sixth above one over C, so two questions in a row
    // could be drawn in quite different places for no reason a player could
    // see.
    const low = diatonicValue(pitch('C', 0, OPENING_OCTAVE))
    const high = diatonicValue(pitch('B', 0, OPENING_OCTAVE))

    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      const first = opensOn([pc(letter), pc('D')])
      expect(first, letter).toBeDefined()
      expect(diatonicValue(first ?? DEFAULT_REGISTER), letter).toBeGreaterThanOrEqual(low)
      expect(diatonicValue(first ?? DEFAULT_REGISTER), letter).toBeLessThanOrEqual(high)
    }
  })

  it('opens exactly where the keyboard drew the key', () => {
    // Which is what makes a fixed row of keys honest for an opening chord: the
    // key shows the note in `OPENING_OCTAVE`, and that is where it lands.
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      expect(opensOn([pc(letter)])?.octave, letter).toBe(OPENING_OCTAVE)
    }
  })

  it('stacks upward in close position, in the order it is given', () => {
    expect(spell(voiceChord([pc('E'), pc('G'), pc('B')]))).toEqual(['E4', 'G4', 'B4'])
    // The order is the player's: pressing G before E puts the E above it.
    expect(spell(voiceChord([pc('G'), pc('E')]))).toEqual(['G4', 'E5'])
  })

  it('never puts two notes on one staff position', () => {
    const places = voiceChord([pc('B'), pc('D'), pc('F')]).map(diatonicValue)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(new Set(places).size).toBe(places.length)
  })

  it('keeps the spelling it was given', () => {
    expect(spell(voiceChord([pc('G', 1)]))).toEqual(['G#4'])
    expect(spell(voiceChord([pc('B', -1)]))).toEqual(['Bb4'])
  })
})

describe('a chord after another', () => {
  const moves = (from: readonly PitchClass[], to: readonly PitchClass[]) => {
    const [first, second] = voiceChords([from, to])
    return {
      first: spell(first ?? []),
      second: spell(second ?? []),
      by: Math.abs(
        chromaticValue(second?.[0] ?? DEFAULT_REGISTER) -
          chromaticValue(first?.[0] ?? DEFAULT_REGISTER),
      ),
    }
  }

  it('resolves a 4–3 by a semitone rather than leaping an octave', () => {
    // The bug this rule exists for: 5/4 over G is D and C, and 5/3 is D and B.
    // The B could not sit on the old B floor, so it jumped to the octave above
    // and the suspension resolved *upward* by a seventh.
    const { first, second, by } = moves([pc('C'), pc('D')], [pc('B'), pc('D')])
    expect(first).toEqual(['C4', 'D4'])
    expect(second).toEqual(['B3', 'D4'])
    expect(by).toBe(1)
  })

  it('moves as little as it can in every suspension the app teaches', () => {
    // 7–6, 9–8 and 6–5 over C. Each keeps its common tones where they were.
    expect(moves([pc('E'), pc('G'), pc('B')], [pc('E'), pc('A')]).second).toEqual([
      'E4',
      'A4',
    ])
    expect(
      moves([pc('E'), pc('G'), pc('D')], [pc('E'), pc('G'), pc('C')]).second,
    ).toEqual(['E4', 'G4', 'C5'])
    expect(moves([pc('E'), pc('A')], [pc('E'), pc('G')]).second).toEqual(['E4', 'G4'])
  })

  it('opens at the nearest octave the staff can actually show', () => {
    // Nearest, and no nearer: an octave below is sometimes closer and off the
    // bottom of the treble clef, and then the chord has to take the further
    // one. That is the clamp doing its job rather than the rule failing, so
    // what is asserted is the whole of it — nothing closer was available.
    const { lowest, highest } = getClef('treble')
    for (const a of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      for (const b of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
        const [first, second] = voiceChords([[pc(a)], [pc(b)]])
        const opened = second?.[0]
        const from = chromaticValue(first?.[0] ?? DEFAULT_REGISTER)
        expect(opened, `${a} to ${b}`).toBeDefined()
        if (opened === undefined) continue

        const chosen = Math.abs(chromaticValue(opened) - from)
        for (const shift of [-1, 1]) {
          const other = { ...opened, octave: opened.octave + shift }
          const reachable =
            diatonicValue(other) >= diatonicValue(lowest) &&
            diatonicValue(other) <= diatonicValue(highest)
          if (!reachable) continue
          expect(
            Math.abs(chromaticValue(other) - from),
            `${a} to ${b}: ${pitchKey(other)} was closer`,
          ).toBeGreaterThanOrEqual(chosen)
        }
      }
    }
  })

  it('follows the chord before it down a whole line', () => {
    const line = voiceChords([
      [pc('E'), pc('G')],
      [pc('D'), pc('F')],
      [pc('C'), pc('E')],
    ])
    const opens = line.map((chord) => chromaticValue(chord[0] ?? DEFAULT_REGISTER))
    for (const [index, open] of opens.slice(1).entries()) {
      expect(Math.abs(open - (opens[index] as number))).toBeLessThanOrEqual(6)
    }
  })
})

describe('what a note already on the staff may do', () => {
  it('never moves when the next one is added', () => {
    // The player builds a chord one key at a time and the app cannot know what
    // is still to come, so the octave is settled by the first note and nothing
    // afterwards may unsettle it. Anchoring on the chord's centre would read
    // better and would move notes already written, which is worse.
    const notes = [pc('E'), pc('G'), pc('B'), pc('D')]
    let previous: string[] = []
    for (let count = 1; count <= notes.length; count += 1) {
      const placed = spell(voiceChord(notes.slice(0, count)))
      expect(placed.slice(0, previous.length), `at ${count}`).toEqual(previous)
      previous = placed
    }
  })
})

describe('the staff it has to fit on', () => {
  it('brings a tall chord anchored high back into reach', () => {
    const { lowest, highest } = getClef('treble')
    // A ninth is four notes spanning a seventh, and the highest opening note
    // there is puts its top above anything the staff can show.
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      const chord = voiceChord([pc(letter), pc('C'), pc('E'), pc('G')])
      for (const note of chord) {
        expect(
          diatonicValue(note),
          `${letter}: ${pitchKey(note)}`,
        ).toBeGreaterThanOrEqual(diatonicValue(lowest))
        expect(diatonicValue(note), `${letter}: ${pitchKey(note)}`).toBeLessThanOrEqual(
          diatonicValue(highest),
        )
      }
    }
  })

  it('moves the whole chord when it does, so the shape is kept', () => {
    const high = voiceChord([pc('B'), pc('D'), pc('F'), pc('A')])
    const gaps = high
      .slice(1)
      .map((note, i) => diatonicValue(note) - diatonicValue(high[i] as never))
    expect(gaps.every((gap) => gap === 2)).toBe(true)
  })
})
