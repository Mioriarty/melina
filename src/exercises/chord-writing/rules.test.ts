import { describe, expect, it } from 'vitest'

import type { ChordQuestion } from '@/exercises/chord-shared/generate'
import { chordPitches, closeChord, type Chord } from '@/lib/music/chord'
import { parseTonicKey, type PitchClass } from '@/lib/music/scale'

import { isWritingCorrect, writingAnswerKey } from './rules'

/**
 * What writing a chord down is graded on.
 *
 * The interesting half is what it refuses to punish: where the notes sit, and
 * — unless a Lage was named — which of them ended up on top. Both are things
 * the prompt never said, and marking someone wrong for one of them would be
 * marking them wrong for something there was no way to get right.
 */

const note = (key: string) => parseTonicKey(key) as PitchClass

function question(chord: Chord, lage = false): ChordQuestion {
  return {
    chord,
    clef: 'treble',
    direction: 'harmonic',
    pitches: chordPitches(chord) ?? [],
    asks: { root: false, inversion: true, lage },
  }
}

const C = note('C')

describe('writing a chord down', () => {
  it('accepts the right notes over the right bass', () => {
    const asked = question(closeChord(C, 'major'))
    expect(isWritingCorrect([note('C'), note('E'), note('G')], asked)).toBe(true)
  })

  it('refuses the right notes over the wrong bass', () => {
    // "Root position" is exactly a statement about which member is lowest, so
    // the same notes over the third are a different answer from the one asked.
    const asked = question(closeChord(C, 'major'))
    expect(isWritingCorrect([note('E'), note('G'), note('C')], asked)).toBe(false)
  })

  it('follows the inversion the question named', () => {
    const first = question(closeChord(C, 'major', 1))
    expect(isWritingCorrect([note('E'), note('G'), note('C')], first)).toBe(true)
    expect(isWritingCorrect([note('C'), note('E'), note('G')], first)).toBe(false)
  })

  it('lets the notes between the two ends stand in any order', () => {
    // Nothing in the prompt says what goes in the middle, so nothing in the
    // verdict may. A seventh chord in root position has two ways to fill it.
    const asked = question(closeChord(C, 'dominant-seventh'))
    expect(isWritingCorrect([note('C'), note('E'), note('G'), note('Bb')], asked)).toBe(
      true,
    )
    expect(isWritingCorrect([note('C'), note('G'), note('E'), note('Bb')], asked)).toBe(
      true,
    )
  })

  it('ignores what ended up on top where no Lage was named', () => {
    const asked = question(closeChord(C, 'major'))
    expect(isWritingCorrect([note('C'), note('G'), note('E')], asked)).toBe(true)
  })

  it('grades the top once a Lage was named', () => {
    const asked = question({ root: C, quality: 'major', inversion: 0, top: 1 }, true)
    // Root in the bass, third on top — which is what Terzlage means.
    expect(isWritingCorrect([note('C'), note('G'), note('E')], asked)).toBe(true)
    expect(isWritingCorrect([note('C'), note('E'), note('G')], asked)).toBe(false)
  })

  it('refuses a wrong spelling of the right sound', () => {
    // C–E–G♯ and C–E–A♭ are the same three keys on a piano and two different
    // chords. Which one is written is the whole of what is being asked.
    const asked = question(closeChord(C, 'augmented'))
    expect(isWritingCorrect([note('C'), note('E'), note('G#')], asked)).toBe(true)
    expect(isWritingCorrect([note('C'), note('E'), note('Ab')], asked)).toBe(false)
  })

  it('refuses a chord that is short, long or doubled', () => {
    const asked = question(closeChord(C, 'major'))
    expect(isWritingCorrect([note('C'), note('E')], asked)).toBe(false)
    expect(isWritingCorrect([note('C'), note('E'), note('G'), note('B')], asked)).toBe(
      false,
    )
    expect(isWritingCorrect([note('C'), note('C'), note('E')], asked)).toBe(false)
  })

  it('writes an answer key that reads back as what was pressed', () => {
    expect(writingAnswerKey([note('C'), note('Eb'), note('G')])).toBe('C+Eb+G')
  })
})
