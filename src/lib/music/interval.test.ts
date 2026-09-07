import { describe, expect, it } from 'vitest'

import {
  defaultSemitones,
  directionBetween,
  intervalBetween,
  intervalKey,
  intervalName,
  intervalSemitones,
  isPerfectFamily,
  isValidInterval,
  octaveSpan,
  parseIntervalKey,
  simpleNumber,
  transpose,
  type Interval,
} from './interval'
import { parsePitch, pitchKey, type Pitch } from './pitch'

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(`bad test pitch: ${text}`)
  return value
}

function between(a: string, b: string): string {
  const interval = intervalBetween(p(a), p(b))
  return interval === undefined ? 'none' : intervalKey(interval)
}

describe('intervalBetween', () => {
  it('distinguishes intervals that sound identical', () => {
    // The whole reason pitches are modelled as spellings. Each pair below is
    // the same number of semitones and a different interval.
    expect(between('C4', 'C4')).toBe('P1') // 0 semitones
    expect(between('C4', 'Dbb4')).toBe('d2') // 0 semitones

    expect(between('C4', 'C#4')).toBe('A1') // 1 semitone
    expect(between('C4', 'Db4')).toBe('m2') // 1 semitone

    expect(between('C4', 'F#4')).toBe('A4') // 6 semitones
    expect(between('C4', 'Gb4')).toBe('d5') // 6 semitones

    expect(between('C4', 'D#4')).toBe('A2') // 3 semitones
    expect(between('C4', 'Eb4')).toBe('m3') // 3 semitones

    expect(between('C#4', 'Eb4')).toBe('d3') // 2 semitones
    expect(between('C4', 'D4')).toBe('M2') // 2 semitones
  })

  it('reads the plain diatonic intervals above C', () => {
    expect(between('C4', 'D4')).toBe('M2')
    expect(between('C4', 'E4')).toBe('M3')
    expect(between('C4', 'F4')).toBe('P4')
    expect(between('C4', 'G4')).toBe('P5')
    expect(between('C4', 'A4')).toBe('M6')
    expect(between('C4', 'B4')).toBe('M7')
    expect(between('C4', 'C5')).toBe('P8')
  })

  it('is direction agnostic', () => {
    expect(between('C4', 'G4')).toBe('P5')
    expect(between('G4', 'C4')).toBe('P5')
    expect(between('E4', 'C4')).toBe('M3')
  })

  it('handles enharmonic spellings across an octave boundary', () => {
    // B#3 sounds like C4 but is spelled a seventh away from C4's letter.
    expect(between('C4', 'B#3')).toBe('d2')
    expect(between('C4', 'Cb4')).toBe('A1')
  })

  it('handles compound intervals', () => {
    expect(between('C4', 'D5')).toBe('M9')
    expect(between('C4', 'E5')).toBe('M10')
    expect(between('C4', 'F5')).toBe('P11')
    expect(between('C4', 'C6')).toBe('P15')
  })

  it('handles double accidentals', () => {
    expect(between('Cb4', 'F#4')).toBe('AA4')
    expect(between('C#4', 'Fb4')).toBe('dd4')
  })

  it('returns undefined for spellings beyond the named qualities', () => {
    // C##4 to Fbb4 is a triply diminished fourth, which has no entry.
    expect(intervalBetween(p('C##4'), p('Fbb4'))).toBeUndefined()
  })
})

describe('directionBetween', () => {
  it('reports which way the second pitch lies', () => {
    expect(directionBetween(p('C4'), p('G4'))).toBe('up')
    expect(directionBetween(p('G4'), p('C4'))).toBe('down')
  })

  it('uses the letter, not the sound, when they disagree', () => {
    // B#3 sounds at or above C4 but is written below it.
    expect(directionBetween(p('C4'), p('B#3'))).toBe('down')
  })

  it('has no direction for a true unison', () => {
    expect(directionBetween(p('C4'), p('C4'))).toBeUndefined()
  })

  it('gives an augmented unison a direction, since it moves', () => {
    expect(directionBetween(p('C4'), p('C#4'))).toBe('up')
    expect(directionBetween(p('C4'), p('Cb4'))).toBe('down')
  })
})

describe('interval numbers', () => {
  it('reduces compound numbers to their simple equivalent', () => {
    expect(simpleNumber(1)).toBe(1)
    expect(simpleNumber(8)).toBe(1)
    expect(simpleNumber(9)).toBe(2)
    expect(simpleNumber(15)).toBe(1)
  })

  it('counts octave spans', () => {
    expect(octaveSpan(1)).toBe(0)
    expect(octaveSpan(7)).toBe(0)
    expect(octaveSpan(8)).toBe(1)
    expect(octaveSpan(15)).toBe(2)
  })

  it('puts unisons, fourths, fifths and octaves in the perfect family', () => {
    expect([1, 4, 5, 8, 11, 12].every(isPerfectFamily)).toBe(true)
    expect([2, 3, 6, 7, 9, 10].some(isPerfectFamily)).toBe(false)
  })

  it('knows the default size of each number', () => {
    expect(defaultSemitones(1)).toBe(0)
    expect(defaultSemitones(5)).toBe(7)
    expect(defaultSemitones(8)).toBe(12)
    expect(defaultSemitones(9)).toBe(14)
  })
})

describe('intervalSemitones', () => {
  it('sizes the qualities of a perfect-family number', () => {
    expect(intervalSemitones({ number: 5, quality: 'diminished' })).toBe(6)
    expect(intervalSemitones({ number: 5, quality: 'perfect' })).toBe(7)
    expect(intervalSemitones({ number: 5, quality: 'augmented' })).toBe(8)
  })

  it('sizes the qualities of an imperfect number', () => {
    expect(intervalSemitones({ number: 3, quality: 'diminished' })).toBe(2)
    expect(intervalSemitones({ number: 3, quality: 'minor' })).toBe(3)
    expect(intervalSemitones({ number: 3, quality: 'major' })).toBe(4)
    expect(intervalSemitones({ number: 3, quality: 'augmented' })).toBe(5)
  })

  it('gives the tritone spellings the same size', () => {
    expect(intervalSemitones({ number: 4, quality: 'augmented' })).toBe(6)
    expect(intervalSemitones({ number: 5, quality: 'diminished' })).toBe(6)
  })
})

describe('isValidInterval', () => {
  it('rejects qualities that cannot exist on a number', () => {
    // A fifth is never major or minor; a third is never perfect.
    expect(isValidInterval({ number: 5, quality: 'major' })).toBe(false)
    expect(isValidInterval({ number: 5, quality: 'minor' })).toBe(false)
    expect(isValidInterval({ number: 3, quality: 'perfect' })).toBe(false)
  })

  it('rejects intervals that would span negative semitones', () => {
    // Shrinking a unison does not make a smaller interval, it inverts it.
    expect(isValidInterval({ number: 1, quality: 'diminished' })).toBe(false)
    expect(isValidInterval({ number: 1, quality: 'doubly-diminished' })).toBe(false)
    // A doubly-diminished second would be −1 semitones, same problem.
    expect(isValidInterval({ number: 2, quality: 'doubly-diminished' })).toBe(false)

    expect(intervalSemitones({ number: 1, quality: 'diminished' })).toBeUndefined()
    expect(transpose(p('C4'), { number: 1, quality: 'diminished' })).toBeUndefined()
    expect(parseIntervalKey('d1')).toBeUndefined()
  })

  it('keeps the zero-width diminished second, which is real', () => {
    // C to D double flat: zero semitones, and still a second. Telling this
    // from a perfect unison is one of the things the app teaches.
    expect(isValidInterval({ number: 2, quality: 'diminished' })).toBe(true)
    expect(intervalSemitones({ number: 2, quality: 'diminished' })).toBe(0)
    expect(pitchKey(transpose(p('C4'), { number: 2, quality: 'diminished' })!)).toBe(
      'Dbb4',
    )

    // And augmented unisons and diminished octaves are ordinary.
    expect(isValidInterval({ number: 1, quality: 'augmented' })).toBe(true)
    expect(isValidInterval({ number: 8, quality: 'diminished' })).toBe(true)
  })

  it('accepts the ones that can', () => {
    expect(isValidInterval({ number: 5, quality: 'perfect' })).toBe(true)
    expect(isValidInterval({ number: 3, quality: 'minor' })).toBe(true)
    expect(isValidInterval({ number: 2, quality: 'diminished' })).toBe(true)
  })
})

describe('transpose', () => {
  it('spells the result correctly rather than enharmonically', () => {
    // Up an augmented fourth from C is F sharp, never G flat.
    expect(pitchKey(transpose(p('C4'), { number: 4, quality: 'augmented' })!)).toBe('F#4')
    expect(pitchKey(transpose(p('C4'), { number: 5, quality: 'diminished' })!)).toBe(
      'Gb4',
    )
  })

  it('carries octaves', () => {
    expect(pitchKey(transpose(p('C4'), { number: 8, quality: 'perfect' })!)).toBe('C5')
    expect(pitchKey(transpose(p('A4'), { number: 3, quality: 'minor' })!)).toBe('C5')
  })

  it('transposes downward', () => {
    expect(pitchKey(transpose(p('C4'), { number: 5, quality: 'perfect' }, 'down')!)).toBe(
      'F3',
    )
    expect(pitchKey(transpose(p('C4'), { number: 2, quality: 'minor' }, 'down')!)).toBe(
      'B3',
    )
  })

  it('refuses results that would need a triple accidental', () => {
    // An augmented fourth above B double sharp would be E triple sharp.
    // (Above plain B sharp it is E double sharp, which is legal notation.)
    expect(pitchKey(transpose(p('B#4'), { number: 4, quality: 'augmented' })!)).toBe(
      'E##5',
    )
    expect(transpose(p('B##4'), { number: 4, quality: 'augmented' })).toBeUndefined()
  })

  it('round-trips: measuring a transposed pitch returns the interval', () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]
    const qualities = [
      'doubly-diminished',
      'diminished',
      'minor',
      'perfect',
      'major',
      'augmented',
      'doubly-augmented',
    ] as const

    const roots = ['C4', 'D4', 'Eb4', 'F#3', 'Ab4', 'B4', 'G#3', 'Bb2']
    let checked = 0

    for (const root of roots) {
      for (const number of numbers) {
        for (const quality of qualities) {
          const interval: Interval = { number, quality }
          if (!isValidInterval(interval)) continue

          for (const direction of ['up', 'down'] as const) {
            const moved = transpose(p(root), interval, direction)
            if (moved === undefined) continue

            const measured = intervalBetween(p(root), moved)
            expect(
              measured,
              `${root} ${direction} ${intervalKey(interval)} -> ${pitchKey(moved)}`,
            ).toEqual(interval)
            checked += 1
          }
        }
      }
    }

    // Guard against the loop silently skipping everything.
    expect(checked).toBeGreaterThan(400)
  })
})

describe('naming', () => {
  it('produces readable names', () => {
    expect(intervalName({ number: 5, quality: 'perfect' })).toBe('Perfect fifth')
    expect(intervalName({ number: 3, quality: 'diminished' })).toBe('Diminished third')
    expect(intervalName({ number: 1, quality: 'perfect' })).toBe('Perfect unison')
    expect(intervalName({ number: 8, quality: 'perfect' })).toBe('Perfect octave')
  })

  it('round-trips keys', () => {
    for (const key of [
      'P1',
      'A1',
      'd2',
      'm2',
      'M2',
      'A4',
      'd5',
      'P8',
      'dd7',
      'AA4',
      'M9',
    ]) {
      const interval = parseIntervalKey(key)
      expect(interval, key).toBeDefined()
      expect(intervalKey(interval!)).toBe(key)
    }
  })

  it('rejects keys that are not real intervals', () => {
    expect(parseIntervalKey('M5')).toBeUndefined()
    expect(parseIntervalKey('P3')).toBeUndefined()
    expect(parseIntervalKey('X4')).toBeUndefined()
    expect(parseIntervalKey('')).toBeUndefined()
  })
})
