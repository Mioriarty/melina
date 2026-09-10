import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, parseMeter, type TimeSignature } from './meter'
import {
  barCount,
  barOfTick,
  barRhythm,
  beatInBar,
  impactCount,
  isValidPhrase,
  nextBarline,
  opensOnDownbeat,
  parsePhrase,
  parsePhraseBars,
  phraseKey,
  phraseOnsets,
  phraseTicks,
  samePhrase,
  type Phrase,
} from './phrase'
import { rhythmDivision } from './rhythm'

const FOUR_FOUR = parseMeter('4/4') as TimeSignature
const THREE_FOUR = parseMeter('3/4') as TimeSignature

const phrase = (meter: TimeSignature, ...bars: number[][]): Phrase => ({ meter, bars })

describe('a phrase is a list of bars', () => {
  it('measures each bar from its own barline', () => {
    const two = phrase(FOUR_FOUR, [0, 120], [0, 60])
    expect(barRhythm(two, 0).onsets).toEqual([0, 120])
    expect(barRhythm(two, 1).onsets).toEqual([0, 60])
  })

  it('hands each bar over in the shape a single bar already has', () => {
    const two = phrase(FOUR_FOUR, [0], [0, 20])
    expect(barRhythm(two, 1).meter).toBe(FOUR_FOUR)
    // Anything built for one bar takes one, untouched.
    expect(rhythmDivision(barRhythm(two, 1))).toBe('triplet')
  })

  it('counts bars, ticks and impacts', () => {
    const two = phrase(FOUR_FOUR, [0, 120], [0, 60, 90])
    expect(barCount(two)).toBe(2)
    expect(phraseTicks(two)).toBe(2 * 4 * TICKS_PER_BEAT)
    expect(impactCount(two)).toBe(5)
  })

  it('lays the impacts end to end when the line is wanted whole', () => {
    const two = phrase(FOUR_FOUR, [0, 120], [0, 60])
    expect(phraseOnsets(two)).toEqual([0, 120, 240, 300])
  })

  it('takes the metre from the phrase, so two bars cannot disagree', () => {
    const two = phrase(THREE_FOUR, [0], [0])
    expect(phraseTicks(two)).toBe(2 * 3 * TICKS_PER_BEAT)
    expect(barRhythm(two, 1).meter.beats).toBe(3)
  })
})

describe('where a tick sits', () => {
  const two = phrase(FOUR_FOUR, [0], [0])

  it('names the bar a phrase tick falls in', () => {
    expect(barOfTick(two, 0)).toBe(0)
    expect(barOfTick(two, 239)).toBe(0)
    expect(barOfTick(two, 240)).toBe(1)
  })

  it('finds the barline a note may not cross', () => {
    expect(nextBarline(two, 0)).toBe(240)
    expect(nextBarline(two, 239)).toBe(240)
    expect(nextBarline(two, 240)).toBe(480)
  })

  it('reads the beat within the bar rather than within the phrase', () => {
    expect(beatInBar(two, 0)).toBe(0)
    expect(beatInBar(two, 180)).toBe(3)
    // First beat of the second bar, not the fifth beat of anything.
    expect(beatInBar(two, 240)).toBe(0)
  })
})

describe('two phrases are the same when their impacts are', () => {
  it('compares bar by bar', () => {
    const a = phrase(FOUR_FOUR, [0, 120], [0, 60])
    const b = phrase(FOUR_FOUR, [0, 120], [0, 60])
    expect(samePhrase(a, b)).toBe(true)
  })

  it('separates impacts that differ only in which bar they are in', () => {
    const a = phrase(FOUR_FOUR, [0, 120], [0])
    const b = phrase(FOUR_FOUR, [0], [0, 120])
    expect(samePhrase(a, b)).toBe(false)
  })

  it('separates phrases of different lengths', () => {
    expect(samePhrase(phrase(FOUR_FOUR, [0]), phrase(FOUR_FOUR, [0], [0]))).toBe(false)
  })

  it('separates metres', () => {
    expect(samePhrase(phrase(FOUR_FOUR, [0]), phrase(THREE_FOUR, [0]))).toBe(false)
  })
})

describe('the storable form', () => {
  it('round-trips a phrase through its key', () => {
    const two = phrase(FOUR_FOUR, [0, 90, 120], [0, 60])
    expect(phraseKey(two)).toBe('0,90,120|0,60')
    expect(parsePhrase(phraseKey(two), FOUR_FOUR)).toEqual(two)
  })

  it('reads a one-bar phrase exactly as the rhythm it is', () => {
    expect(phraseKey(phrase(FOUR_FOUR, [0, 60, 120, 180]))).toBe('0,60,120,180')
  })

  it('keeps a bar of silence in the middle', () => {
    expect(parsePhraseBars('0,60||0')).toEqual([[0, 60], [], [0]])
  })

  it('refuses impacts out of order or below the barline', () => {
    expect(parsePhraseBars('60,0')).toBeUndefined()
    expect(parsePhraseBars('0|-60')).toBeUndefined()
    expect(parsePhraseBars('0|x')).toBeUndefined()
  })

  it('refuses a phrase whose impacts run past their own bar', () => {
    expect(parsePhrase('0,300', FOUR_FOUR)).toBeUndefined()
    expect(isValidPhrase(phrase(FOUR_FOUR))).toBe(false)
  })
})

describe('opening on the downbeat', () => {
  it('is what gives the shown first note somewhere to sit', () => {
    expect(opensOnDownbeat(phrase(FOUR_FOUR, [0, 120]))).toBe(true)
    expect(opensOnDownbeat(phrase(FOUR_FOUR, [60, 120]))).toBe(false)
  })
})
