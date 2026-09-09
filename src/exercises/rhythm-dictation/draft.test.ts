import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from '@/lib/music/meter'
import { onsetsOf } from '@/lib/notation/rhythmNotation'

import {
  append,
  arm,
  canAppend,
  canArm,
  draftNodes,
  draftRhythm,
  draftTicks,
  emptyDraft,
  entryTicks,
  isFull,
  removeLast,
  type RhythmDraft,
} from './draft'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }

const note = (dur: 1 | 2 | 4 | 8 | 16, dots: 0 | 1 = 0) =>
  ({ kind: 'note', dur, dots }) as const
const rest = (dur: 1 | 2 | 4 | 8 | 16, dots: 0 | 1 = 0) =>
  ({ kind: 'rest', dur, dots }) as const

/** Type a sequence of keys into an empty bar. */
function type(
  meter: TimeSignature,
  keys: readonly { kind: 'note' | 'rest'; dur: 1 | 2 | 4 | 8 | 16; dots: 0 | 1 }[],
): RhythmDraft {
  return keys.reduce<RhythmDraft>((draft, key) => append(draft, key), emptyDraft(meter))
}

describe('typing a bar', () => {
  it('starts empty', () => {
    const draft = emptyDraft(FOUR_FOUR)
    expect(draftTicks(draft)).toBe(0)
    expect(isFull(draft)).toBe(false)
    expect(draftRhythm(draft).onsets).toEqual([])
  })

  it('places each key after the last', () => {
    const draft = type(FOUR_FOUR, [note(4), note(8), note(8), note(2)])
    expect(draftRhythm(draft).onsets).toEqual([0, 60, 90, 120])
    expect(isFull(draft)).toBe(true)
  })

  it('counts a rest as time passing, not as an impact', () => {
    // The reason the rest key can never make an answer wrong: a rest and a
    // held note say exactly the same thing about a drum.
    const withRest = type(FOUR_FOUR, [note(4), rest(4), note(2)])
    const withHold = type(FOUR_FOUR, [note(2), note(2)])

    expect(draftRhythm(withRest).onsets).toEqual([0, 120])
    expect(draftRhythm(withHold).onsets).toEqual([0, 120])
  })

  it('lets a dot lengthen a value by half', () => {
    const draft = type(FOUR_FOUR, [note(4, 1), note(8), note(2)])
    expect(draftRhythm(draft).onsets).toEqual([0, 90, 120])
    expect(isFull(draft)).toBe(true)
  })
})

describe('what may be pressed', () => {
  it('refuses a value that would overflow the bar', () => {
    const draft = type(FOUR_FOUR, [note(2), note(4)])

    expect(canAppend(draft, note(4))).toBe(true)
    expect(canAppend(draft, note(2))).toBe(false)
    expect(canAppend(draft, note(1))).toBe(false)
  })

  it('lets a plain value run across a beat, which is what a half note is', () => {
    const draft = type(FOUR_FOUR, [note(4)])
    expect(canAppend(draft, note(2))).toBe(true)
  })

  it('refuses a dotted sixteenth, which cannot be written on this grid', () => {
    // 22.5 ticks. No impact can ever ask for one, so the key is simply dead.
    expect(entryTicks({ kind: 'note', dur: 16, dots: 1 })).toBeUndefined()
    expect(canAppend(emptyDraft(FOUR_FOUR), note(16, 1))).toBe(false)
  })

  it('leaves a full bar with nothing left to press', () => {
    const draft = type(FOUR_FOUR, [note(1)])
    expect(isFull(draft)).toBe(true)
    for (const dur of [1, 2, 4, 8, 16] as const) {
      expect(canAppend(draft, note(dur)), `${dur}`).toBe(false)
    }
  })

  it('fills a shorter bar sooner', () => {
    const draft = type(THREE_FOUR, [note(4), note(4), note(4)])
    expect(isFull(draft)).toBe(true)
    expect(draftTicks(draft)).toBe(ticksPerMeasure(THREE_FOUR))
  })
})

describe('taking a key back', () => {
  it('removes the last one and no more', () => {
    const draft = type(FOUR_FOUR, [note(4), note(8), note(8)])
    const back = removeLast(draft)

    expect(draftRhythm(back).onsets).toEqual([0, 60])
    expect(draftTicks(back)).toBe(90)
  })

  it('does nothing to an empty bar', () => {
    expect(removeLast(emptyDraft(FOUR_FOUR)).entries).toEqual([])
  })

  it('walks all the way back to empty', () => {
    let draft = type(FOUR_FOUR, [note(4), note(8), note(8), note(2)])
    for (let i = 0; i < 4; i += 1) draft = removeLast(draft)

    expect(draft.entries).toEqual([])
    expect(draftTicks(draft)).toBe(0)
  })
})

describe('tuplets', () => {
  it('may only be started on an untouched beat', () => {
    expect(canArm(emptyDraft(FOUR_FOUR))).toBe(true)
    expect(canArm(type(FOUR_FOUR, [note(4)]))).toBe(true)
    // Half way through a beat there is no room left for a bracket.
    expect(canArm(type(FOUR_FOUR, [note(8)]))).toBe(false)
    expect(canArm(type(FOUR_FOUR, [note(1)]))).toBe(false)
  })

  it('borrows its values, so three eighths fill one beat', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    for (let i = 0; i < 3; i += 1) draft = append(draft, note(8))

    expect(draftTicks(draft)).toBe(TICKS_PER_BEAT)
    expect(draftRhythm(draft).onsets).toEqual([0, 20, 40])
  })

  it('closes itself as soon as its beat is full', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    for (let i = 0; i < 3; i += 1) draft = append(draft, note(8))

    // Nothing to switch back: the next key is a plain one again.
    expect(draft.tuplet).toBeUndefined()
    draft = append(draft, note(4))
    expect(draftRhythm(draft).onsets).toEqual([0, 20, 40, 60])
  })

  it('will not let a bracket reach past its own beat', () => {
    const draft = arm(emptyDraft(FOUR_FOUR), 3)
    expect(canAppend(draft, note(8))).toBe(true)
    expect(canAppend(draft, note(4))).toBe(true)
    // Two thirds of a half note is more than the beat can hold.
    expect(canAppend(draft, note(2))).toBe(false)
  })

  it('takes an uneven triplet', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    draft = append(draft, note(4))
    draft = append(draft, note(8))

    expect(draftRhythm(draft).onsets).toEqual([0, 40])
    expect(draftTicks(draft)).toBe(TICKS_PER_BEAT)
  })

  it('takes a quintuplet', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 5)
    for (let i = 0; i < 5; i += 1) draft = append(draft, note(16))

    expect(draftTicks(draft)).toBe(TICKS_PER_BEAT)
    expect(draftRhythm(draft).onsets).toEqual([0, 12, 24, 36, 48])
  })

  it('arms itself again when a key is taken back inside one', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    draft = append(draft, note(8))
    draft = append(draft, note(8))
    draft = append(draft, note(8))
    expect(draft.tuplet).toBeUndefined()

    // Back inside the bracket, so the next key belongs to it again.
    draft = removeLast(draft)
    expect(draft.tuplet).toBe(3)

    draft = removeLast(draft)
    draft = removeLast(draft)
    expect(draft.tuplet).toBeUndefined()
  })

  it('refuses to be armed part way through a beat', () => {
    const draft = arm(type(FOUR_FOUR, [note(8)]), 3)
    expect(draft.tuplet).toBeUndefined()
  })
})

describe('the draft as notation', () => {
  it('draws exactly the impacts it says', () => {
    const draft = type(FOUR_FOUR, [note(4), rest(8), note(8), note(2)])
    expect(onsetsOf(draftNodes(draft))).toEqual(draftRhythm(draft).onsets)
  })

  it('shows what was written, not a tidied-up version of it', () => {
    // Someone who enters a quarter rest sees a quarter rest, even though the
    // same impacts would have been spelled as a longer note.
    const nodes = draftNodes(type(FOUR_FOUR, [note(4), rest(4), note(2)]))
    const flat = JSON.stringify(nodes)

    expect(flat).toContain('"rest"')
    expect(onsetsOf(nodes)).toEqual([0, 120])
  })

  it('brackets what was entered under a bracket', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    for (let i = 0; i < 3; i += 1) draft = append(draft, note(8))
    draft = append(draft, note(4))
    draft = append(draft, note(2))

    const nodes = draftNodes(draft)
    const tuplets = nodes.filter((node) => node.kind === 'tuplet')

    expect(tuplets).toHaveLength(1)
    expect(onsetsOf(nodes)).toEqual([0, 20, 40, 60, 120])
  })

  it('grows without ever moving what is already there', () => {
    const keys = [note(4), note(8), note(8), note(16), note(16), note(8), note(2)]
    let previous: number[] = []

    for (let count = 1; count <= keys.length; count += 1) {
      const onsets = onsetsOf(draftNodes(type(FOUR_FOUR, keys.slice(0, count))))
      expect(onsets.slice(0, previous.length)).toEqual(previous)
      previous = onsets
    }
  })

  it('draws an empty bar as nothing at all', () => {
    expect(draftNodes(emptyDraft(FOUR_FOUR))).toEqual([])
  })
})
