import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from '@/lib/music/meter'
import { barRhythm } from '@/lib/music/phrase'
import { notateRhythm, onsetsOf } from '@/lib/notation/rhythmNotation'

import {
  append,
  arm,
  canAppend,
  canArm,
  canRemove,
  currentBar,
  draftNodes,
  draftPhrase,
  draftPitches,
  draftTicks,
  emptyDraft,
  entryTicks,
  isFull,
  leadingEntries,
  removeLast,
  seededDraft,
  totalTicks,
  type BarDraft,
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
): BarDraft {
  return keys.reduce<BarDraft>((draft, key) => append(draft, key), emptyDraft(meter))
}

describe('typing a bar', () => {
  it('starts empty', () => {
    const draft = emptyDraft(FOUR_FOUR)
    expect(draftTicks(draft)).toBe(0)
    expect(isFull(draft)).toBe(false)
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([])
  })

  it('places each key after the last', () => {
    const draft = type(FOUR_FOUR, [note(4), note(8), note(8), note(2)])
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 60, 90, 120])
    expect(isFull(draft)).toBe(true)
  })

  it('counts a rest as time passing, not as an impact', () => {
    // The reason the rest key can never make an answer wrong: a rest and a
    // held note say exactly the same thing about a drum.
    const withRest = type(FOUR_FOUR, [note(4), rest(4), note(2)])
    const withHold = type(FOUR_FOUR, [note(2), note(2)])

    expect(barRhythm(draftPhrase(withRest), 0).onsets).toEqual([0, 120])
    expect(barRhythm(draftPhrase(withHold), 0).onsets).toEqual([0, 120])
  })

  it('lets a dot lengthen a value by half', () => {
    const draft = type(FOUR_FOUR, [note(4, 1), note(8), note(2)])
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 90, 120])
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

    expect(barRhythm(draftPhrase(back), 0).onsets).toEqual([0, 60])
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
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 20, 40])
  })

  it('closes itself as soon as its beat is full', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    for (let i = 0; i < 3; i += 1) draft = append(draft, note(8))

    // Nothing to switch back: the next key is a plain one again.
    expect(draft.tuplet).toBeUndefined()
    draft = append(draft, note(4))
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 20, 40, 60])
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

    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 40])
    expect(draftTicks(draft)).toBe(TICKS_PER_BEAT)
  })

  it('takes a quintuplet', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 5)
    for (let i = 0; i < 5; i += 1) draft = append(draft, note(16))

    expect(draftTicks(draft)).toBe(TICKS_PER_BEAT)
    expect(barRhythm(draftPhrase(draft), 0).onsets).toEqual([0, 12, 24, 36, 48])
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
    expect(onsetsOf(draftNodes(draft)[0] ?? [])).toEqual(
      barRhythm(draftPhrase(draft), 0).onsets,
    )
  })

  it('shows what was written, not a tidied-up version of it', () => {
    // Someone who enters a quarter rest sees a quarter rest, even though the
    // same impacts would have been spelled as a longer note.
    const nodes = draftNodes(type(FOUR_FOUR, [note(4), rest(4), note(2)]))[0] ?? []
    const flat = JSON.stringify(nodes)

    expect(flat).toContain('"rest"')
    expect(onsetsOf(nodes)).toEqual([0, 120])
  })

  it('brackets what was entered under a bracket', () => {
    let draft = arm(emptyDraft(FOUR_FOUR), 3)
    for (let i = 0; i < 3; i += 1) draft = append(draft, note(8))
    draft = append(draft, note(4))
    draft = append(draft, note(2))

    const nodes = draftNodes(draft)[0] ?? []
    const tuplets = nodes.filter((node) => node.kind === 'tuplet')

    expect(tuplets).toHaveLength(1)
    expect(onsetsOf(nodes)).toEqual([0, 20, 40, 60, 120])
  })

  it('grows without ever moving what is already there', () => {
    const keys = [note(4), note(8), note(8), note(16), note(16), note(8), note(2)]
    let previous: number[] = []

    for (let count = 1; count <= keys.length; count += 1) {
      const onsets = onsetsOf(draftNodes(type(FOUR_FOUR, keys.slice(0, count)))[0] ?? [])
      expect(onsets.slice(0, previous.length)).toEqual(previous)
      previous = onsets
    }
  })

  it('draws an empty bar as nothing at all', () => {
    expect(draftNodes(emptyDraft(FOUR_FOUR))).toEqual([[]])
  })
})

/* ------------------------------------------------- more than one bar

   Everything above is a single bar, which is all rhythmic dictation ever
   answers. Melodic dictation answers up to four, and what that adds is a
   barline the keyboard has to respect, a phrase spread across bars, and a
   given first note that backspace may not reach. */

/** Type into a draft of several bars. */
function typeInto(draft: BarDraft, keys: readonly Parameters<typeof append>[1][]) {
  return keys.reduce<BarDraft>((current, key) => append(current, key), draft)
}

const middleC = { letter: 'C' as const, alteration: 0 as const, octave: 4 }
const d4 = { letter: 'D' as const, alteration: 0 as const, octave: 4 }

describe('a draft of several bars', () => {
  it('is full only when every bar is', () => {
    const two = emptyDraft(FOUR_FOUR, 2)
    expect(totalTicks(two)).toBe(2 * ticksPerMeasure(FOUR_FOUR))

    const oneBarIn = typeInto(two, [note(1)])
    expect(isFull(oneBarIn)).toBe(false)
    expect(isFull(typeInto(oneBarIn, [note(1)]))).toBe(true)
  })

  it('measures each bar from its own barline', () => {
    const draft = typeInto(emptyDraft(FOUR_FOUR, 2), [
      note(2),
      note(2),
      note(4),
      note(4),
      note(2),
    ])
    expect(draftPhrase(draft).bars).toEqual([
      [0, 120],
      [0, 60, 120],
    ])
  })

  it('says which bar is being written into', () => {
    const draft = emptyDraft(FOUR_FOUR, 2)
    expect(currentBar(draft)).toBe(0)
    expect(currentBar(typeInto(draft, [note(1)]))).toBe(1)
  })

  it('keeps an untouched bar as an empty list rather than a missing one', () => {
    // The page reserves room for every bar from the first keypress, so a bar
    // not yet reached still has to be there to hold its width.
    const draft = typeInto(emptyDraft(FOUR_FOUR, 3), [note(1)])
    expect(draftPhrase(draft).bars).toHaveLength(3)
    expect(draftNodes(draft)).toHaveLength(3)
    expect(draftNodes(draft)[2]).toEqual([])
  })
})

describe('the barline a value may not cross', () => {
  it('refuses a value that would run past it', () => {
    // Three beats used; a half note would reach into the next bar.
    const draft = typeInto(emptyDraft(FOUR_FOUR, 2), [note(2), note(4)])
    expect(canAppend(draft, { dur: 2, dots: 0 })).toBe(false)
    expect(canAppend(draft, { dur: 4, dots: 0 })).toBe(true)
  })

  it('allows the same value once the barline is behind it', () => {
    const draft = typeInto(emptyDraft(FOUR_FOUR, 2), [note(1)])
    expect(canAppend(draft, { dur: 1, dots: 0 })).toBe(true)
  })

  it('refuses everything once the last bar is full', () => {
    const draft = typeInto(emptyDraft(FOUR_FOUR, 2), [note(1), note(1)])
    expect(canAppend(draft, { dur: 16, dots: 0 })).toBe(false)
  })

  it('is what means no answer ever needs a tie', () => {
    // A sound running into the next bar is written as a note and then a rest,
    // which is what a single bar already does for any gap one value cannot
    // span. Nothing here can produce a value that crosses a barline, so
    // nothing downstream ever has to tie one.
    const spans = [1, 2, 4, 8, 16] as const
    for (const dur of spans) {
      for (const dots of [0, 1] as const) {
        let draft = emptyDraft(FOUR_FOUR, 2)
        // Fill up to every position a value could start from.
        for (let step = 0; step < 32; step += 1) {
          if (canAppend(draft, { dur, dots })) {
            const before = draftTicks(draft)
            draft = append(draft, { kind: 'note', dur, dots })
            const after = draftTicks(draft)
            const perBar = ticksPerMeasure(FOUR_FOUR)
            expect(Math.floor(before / perBar), `${dur}.${dots} from ${before}`).toBe(
              Math.floor((after - 1) / perBar),
            )
          } else if (!isFull(draft)) {
            draft = append(draft, { kind: 'note', dur: 16, dots: 0 })
          } else {
            break
          }
        }
      }
    }
  })
})

describe('the note that was given', () => {
  const seed = seededDraft(FOUR_FOUR, 1, [
    { kind: 'note', dur: 4, dots: 0, pitch: middleC },
  ])

  it('is already written, and counts towards the bar', () => {
    expect(draftTicks(seed)).toBe(TICKS_PER_BEAT)
    expect(draftPhrase(seed).bars).toEqual([[0]])
    expect(draftPitches(seed)).toEqual([middleC])
  })

  it('cannot be taken back', () => {
    expect(canRemove(seed)).toBe(false)
    expect(removeLast(seed).entries).toHaveLength(1)
  })

  it('lets everything typed after it be taken back, and no further', () => {
    const written = typeInto(seed, [
      { kind: 'note', dur: 4, dots: 0, pitch: d4 },
      { kind: 'rest', dur: 4, dots: 0 },
    ])
    expect(canRemove(written)).toBe(true)

    const back = removeLast(removeLast(written))
    expect(back.entries).toHaveLength(1)
    expect(canRemove(back)).toBe(false)
    expect(removeLast(back).entries).toHaveLength(1)
  })

  it('opens on the downbeat, which is where the phrase has to start', () => {
    expect(draftPhrase(seed).bars[0]?.[0]).toBe(0)
  })
})

describe('the notes a draft says', () => {
  it('gives one per impact, in the order they sound', () => {
    const draft = typeInto(emptyDraft(FOUR_FOUR), [
      { kind: 'note', dur: 4, dots: 0, pitch: middleC },
      { kind: 'rest', dur: 4, dots: 0 },
      { kind: 'note', dur: 4, dots: 0, pitch: d4 },
    ])

    expect(draftPitches(draft)).toEqual([middleC, d4])
    // Which is exactly as many as there are impacts, so the two line up.
    expect(draftPhrase(draft).bars.flat()).toHaveLength(2)
  })

  it('is empty for a rhythm, which has no pitches at all', () => {
    expect(draftPitches(type(FOUR_FOUR, [note(4), note(4)]))).toEqual([])
  })
})

describe('the entries a spelling opens with', () => {
  it('takes the first note and stops there', () => {
    // Not the rests after it: how long the gap to the second note is, is a
    // thing to hear rather than a thing to be told.
    const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [0, 75] })
    const entries = leadingEntries(nodes, middleC)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ kind: 'note', dur: 4, dots: 0, pitch: middleC })
  })

  it('reaches into a beam for it', () => {
    const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [0, 30, 60, 120, 180] })
    expect(leadingEntries(nodes, middleC)).toHaveLength(1)
    expect(leadingEntries(nodes, middleC)[0]).toMatchObject({ dur: 8 })
  })

  it('carries the bracket when the first note is inside a tuplet', () => {
    const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [0, 20, 40, 60, 120, 180] })
    expect(leadingEntries(nodes, middleC)[0]).toMatchObject({ tuplet: 3 })
  })

  it('arms that bracket, so the next key lands inside it too', () => {
    const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [0, 20, 40, 60, 120, 180] })
    const seeded = seededDraft(FOUR_FOUR, 1, leadingEntries(nodes, middleC))
    expect(seeded.tuplet).toBe(3)
  })

  it('keeps the leading rest of a bar that opens in silence', () => {
    const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [60, 120] })
    const entries = leadingEntries(nodes, middleC)
    expect(entries[0]?.kind).toBe('rest')
    expect(entries[entries.length - 1]?.kind).toBe('note')
  })

  it('gives nothing back for a bar with no notes in it', () => {
    expect(leadingEntries(notateRhythm({ meter: FOUR_FOUR, onsets: [] }))).toEqual([])
  })
})
