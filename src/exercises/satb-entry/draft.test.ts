import { describe, expect, it } from 'vitest'

import { pitch, pitchKey } from '@/lib/music/pitch'
import type { VoiceId } from '@/lib/music/satbVoicing'

import {
  canRemove,
  currentSlot,
  emptySatzDraft,
  isFull,
  place,
  placedPitch,
  removeLast,
  satzVoicings,
  voicesAt,
  type SatzDraft,
} from './draft'

/** The bass is given; the player writes the three voices above it, bottom up. */
const ORDER: readonly VoiceId[] = ['tenor', 'alto', 'soprano']

const BASS = [pitch('C', 0, 3), pitch('G', 0, 2), pitch('C', 0, 3)]

const empty = () =>
  emptySatzDraft(
    BASS.map((bass) => ({ bass })),
    ORDER,
  )

const write = (draft: SatzDraft, ...notes: readonly ReturnType<typeof pitch>[]) =>
  notes.reduce(place, draft)

const C = { letter: 'C' as const, alteration: 0 as const }
const G = { letter: 'G' as const, alteration: 0 as const }

describe('filling a setting', () => {
  it('asks for one chord at a time, bottom up', () => {
    let draft = empty()
    expect(currentSlot(draft)).toEqual({ chord: 0, voice: 'tenor' })

    draft = place(draft, pitch('G', 0, 3))
    expect(currentSlot(draft)).toEqual({ chord: 0, voice: 'alto' })

    draft = place(draft, pitch('C', 0, 4))
    expect(currentSlot(draft)).toEqual({ chord: 0, voice: 'soprano' })

    // The chord is full, so the next press belongs to the one after it.
    draft = place(draft, pitch('E', 0, 4))
    expect(currentSlot(draft)).toEqual({ chord: 1, voice: 'tenor' })
  })

  it('is full only when every voice of every chord is written', () => {
    let draft = empty()
    for (let press = 0; press < BASS.length * ORDER.length; press += 1) {
      expect(isFull(draft), `full after ${press} presses`).toBe(false)
      expect(satzVoicings(draft)).toBeUndefined()
      draft = place(draft, pitch('C', 0, 4))
    }

    expect(isFull(draft)).toBe(true)
    expect(satzVoicings(draft)).toHaveLength(BASS.length)
  })

  it('keeps the given voices beside the written ones', () => {
    const draft = write(empty(), pitch('G', 0, 3), pitch('C', 0, 4))
    expect(voicesAt(draft, 0)).toEqual({
      bass: pitch('C', 0, 3),
      tenor: pitch('G', 0, 3),
      alto: pitch('C', 0, 4),
    })
  })

  it('takes back the last press, wherever it was', () => {
    const draft = write(empty(), pitch('G', 0, 3), pitch('C', 0, 4))
    expect(canRemove(draft)).toBe(true)

    const back = removeLast(draft)
    expect(currentSlot(back)).toEqual({ chord: 0, voice: 'alto' })
    expect(canRemove(removeLast(back))).toBe(false)
  })
})

describe('where a pressed note goes', () => {
  it('opens in close position above the voice underneath', () => {
    // Nothing to follow in the first chord, so it stacks from the bass up:
    // the lowest G at or above the bass's C3 is G3. A default in the middle of
    // the tenor's own compass would be A3 instead — legal, and two ledger
    // lines above the bass staff, which made every key draw a note hanging in
    // the air over its own staff.
    const draft = emptySatzDraft([{ bass: pitch('C', 0, 3) }], ORDER)
    expect(pitchKey(placedPitch(draft, G) as ReturnType<typeof pitch>)).toBe('G3')
  })

  it('never opens below the voice underneath it', () => {
    // The bass is up at D3, so the tenor's C3 is under it and the default
    // reaches for the octave above instead.
    const draft = emptySatzDraft([{ bass: pitch('D', 0, 3) }], ORDER)
    expect(pitchKey(placedPitch(draft, C) as ReturnType<typeof pitch>)).toBe('C4')
  })

  it('will sit on the voice underneath rather than under it', () => {
    // A unison with the bass is thin and it is not a fault, so "at or above"
    // is what close position means. The octave switch reaches the other C.
    const draft = emptySatzDraft([{ bass: pitch('C', 0, 3) }], ORDER)
    expect(pitchKey(placedPitch(draft, C) as ReturnType<typeof pitch>)).toBe('C3')
    expect(pitchKey(placedPitch(draft, C, true) as ReturnType<typeof pitch>)).toBe('C4')
  })

  it('follows the same voice from the chord before', () => {
    // The voice-leading default: a line that moves the least. The tenor sang
    // C3, so its next C is C3 and not the octave above.
    const draft = write(
      emptySatzDraft(
        BASS.map((bass) => ({ bass })),
        ORDER,
      ),
      pitch('C', 0, 3),
      pitch('E', 0, 4),
      pitch('G', 0, 4),
    )
    expect(currentSlot(draft)).toEqual({ chord: 1, voice: 'tenor' })
    expect(pitchKey(placedPitch(draft, C) as ReturnType<typeof pitch>)).toBe('C3')
  })

  it('reaches the other octave when the switch is armed', () => {
    const draft = empty()
    const plain = placedPitch(draft, G)
    const shifted = placedPitch(draft, G, true)

    expect(plain).toBeDefined()
    expect(shifted).toBeDefined()
    expect(shifted?.octave).not.toBe(plain?.octave)
    expect(shifted?.letter).toBe(plain?.letter)
  })

  it('draws what it will write when there is no other octave', () => {
    // A voice's compass never spans two octaves, so a letter names two pitches
    // at most and sometimes only one. The switch then does nothing, and the
    // key goes on showing the note that pressing it will actually put down —
    // which is why an armed switch can never mislead.
    // The bass runs E2 to C4, so its only D is D3: D2 is under the bottom and
    // D4 over the top.
    const draft = emptySatzDraft([{}], ['bass'])
    const only = { letter: 'D' as const, alteration: 0 as const }
    expect(pitchKey(placedPitch(draft, only) as ReturnType<typeof pitch>)).toBe('D3')
    expect(placedPitch(draft, only, true)).toEqual(placedPitch(draft, only))
  })

  it('still points somewhere once everything is written', () => {
    // A key that loses its picture at the moment of answering resizes under
    // the hand that just pressed it.
    let draft = empty()
    while (!isFull(draft)) draft = place(draft, pitch('C', 0, 4))
    expect(placedPitch(draft, G)).toBeDefined()
  })
})
