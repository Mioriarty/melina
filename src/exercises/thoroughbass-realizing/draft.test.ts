import { describe, expect, it } from 'vitest'

import { diatonicValue, pitchKey } from '@/lib/music/pitch'
import type { PitchClass } from '@/lib/music/scale'

import {
  canPlace,
  canRemove,
  chordPitches,
  currentEvent,
  currentSlot,
  draftAnswer,
  emptyChordDraft,
  isFull,
  place,
  removeLast,
} from './draft'

const note = (letter: string, alteration = 0): PitchClass => ({
  letter: letter as PitchClass['letter'],
  alteration: alteration as PitchClass['alteration'],
})

describe('placing a chord', () => {
  it('fills exactly as many notes as the figure asks for', () => {
    // Which is why there is no confirm key: the chord is exactly fillable, so
    // the last press left is the one that completes it.
    let draft = emptyChordDraft([2])
    expect(isFull(draft)).toBe(false)
    draft = place(draft, note('E'))
    expect(isFull(draft)).toBe(false)
    draft = place(draft, note('G'))
    expect(isFull(draft)).toBe(true)
  })

  it('refuses a note already in the chord', () => {
    // No doubling: the answer is the set of distinct notes above the bass, so
    // a repeat can never be right and the key says so before the press.
    const draft = place(emptyChordDraft([3]), note('E'))
    expect(canPlace(draft, note('E'))).toBe(false)
    expect(canPlace(draft, note('E', 1))).toBe(true)
    expect(canPlace(draft, note('G'))).toBe(true)
  })

  it('takes nothing more once it is full', () => {
    const draft = place(place(emptyChordDraft([2]), note('E')), note('G'))
    expect(canPlace(draft, note('B'))).toBe(false)
    expect(draftAnswer(draft)[0]).toHaveLength(2)
  })

  it('moves to the next bass note when this one is full', () => {
    let draft = emptyChordDraft([2, 2])
    expect(currentEvent(draft)).toBe(0)
    draft = place(place(draft, note('E')), note('G'))
    expect(currentEvent(draft)).toBe(1)
    expect(isFull(draft)).toBe(false)
  })
})

describe('where the notes land', () => {
  it('stacks upward in close position, above middle C', () => {
    const draft = place(place(emptyChordDraft([3]), note('E')), note('G'))
    expect(chordPitches(draft, 0).map(pitchKey)).toEqual(['E4', 'G4'])
  })

  it('never puts two notes on one staff position', () => {
    const draft = place(
      place(place(emptyChordDraft([3]), note('B')), note('D')),
      note('F'),
    )
    const places = chordPitches(draft, 0).map(diatonicValue)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(new Set(places).size).toBe(places.length)
  })

  it('carries the spelling it was given, because the figure asked for it', () => {
    // ♯5 over C is G♯ and ♭6 is A♭: one sound, two written notes, and which
    // one the figure wanted is exactly what is being read.
    const draft = place(emptyChordDraft([2]), note('G', 1))
    expect(chordPitches(draft, 0).map(pitchKey)).toEqual(['G#4'])
  })
})

describe('backspace', () => {
  it('takes the last note back, across bass notes', () => {
    let draft = place(place(emptyChordDraft([2, 2]), note('E')), note('G'))
    draft = place(draft, note('B'))
    expect(currentEvent(draft)).toBe(1)
    draft = removeLast(draft)
    expect(draftAnswer(draft)[1]).toHaveLength(0)
    draft = removeLast(draft)
    expect(draftAnswer(draft)[0]).toHaveLength(1)
  })

  it('does nothing with nothing to take back', () => {
    expect(canRemove(emptyChordDraft([2]))).toBe(false)
  })
})

describe('where the next press goes', () => {
  // The draft's slots are flat, because a suspension is two chords under one
  // bass note; the grouping comes back in from the question.
  const line = [1, 2, 1]

  it('walks the flat slots back into bass notes and columns', () => {
    let draft = emptyChordDraft([2, 2, 2, 2])
    expect(currentSlot(draft, line)).toEqual({ event: 0, position: 0 })

    draft = place(place(draft, note('E')), note('G'))
    expect(currentSlot(draft, line)).toEqual({ event: 1, position: 0 })

    draft = place(place(draft, note('C')), note('F'))
    expect(currentSlot(draft, line)).toEqual({ event: 1, position: 1 })

    draft = place(place(draft, note('C')), note('E'))
    expect(currentSlot(draft, line)).toEqual({ event: 2, position: 0 })
  })

  it('is nowhere once the last chord is full', () => {
    let draft = emptyChordDraft([1])
    draft = place(draft, note('E'))
    expect(currentSlot(draft, [1])).toBeUndefined()
  })
})
