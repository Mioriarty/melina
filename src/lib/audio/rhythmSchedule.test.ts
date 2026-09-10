import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, type TimeSignature } from '@/lib/music/meter'
import type { Phrase } from '@/lib/music/phrase'
import type { Rhythm } from '@/lib/music/rhythm'

import { melodyDurations, phraseSchedule, rhythmSchedule } from './rhythmSchedule'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }

function bar(onsets: readonly number[], meter = FOUR_FOUR): Rhythm {
  return { meter, onsets }
}

describe('rhythmSchedule', () => {
  it('counts in a whole bar before the rhythm', () => {
    // A whole bar, because what a count-in establishes is where beat one is —
    // the thing every answer is measured from — not the tempo.
    const schedule = rhythmSchedule(bar([0]), { tempo: 60, metronome: 'count-in' })

    expect(schedule.clicks.map((click) => click.time)).toEqual([0, 1, 2, 3])
    expect(schedule.startsAt).toBe(4)
    expect(schedule.hits).toEqual([4])
  })

  it('counts in the meter it is given', () => {
    const schedule = rhythmSchedule(bar([0], THREE_FOUR), {
      tempo: 60,
      metronome: 'count-in',
    })

    expect(schedule.clicks).toHaveLength(3)
    expect(schedule.startsAt).toBe(3)
  })

  it('accents the first beat of every bar and no other', () => {
    const schedule = rhythmSchedule(bar([0]), { tempo: 120, metronome: 'throughout' })
    const accented = schedule.clicks.filter((click) => click.accented)

    expect(accented).toHaveLength(2)
    expect(accented.map((click) => click.time)).toEqual([0, schedule.startsAt])
  })

  it('keeps the click going underneath when asked, and stops it when not', () => {
    const options = { tempo: 60 } as const

    expect(
      rhythmSchedule(bar([0]), { ...options, metronome: 'count-in' }).clicks,
    ).toHaveLength(4)
    expect(
      rhythmSchedule(bar([0]), { ...options, metronome: 'throughout' }).clicks,
    ).toHaveLength(8)
  })

  it('places every impact at its own tick', () => {
    const schedule = rhythmSchedule(bar([0, 30, 45, 120]), {
      tempo: 60,
      metronome: 'count-in',
    })

    // One second to the beat at 60bpm, so a tick is a sixtieth of a second.
    expect(schedule.hits).toEqual([4, 4.5, 4.75, 6])
  })

  it('scales with the tempo', () => {
    const slow = rhythmSchedule(bar([0, 60]), { tempo: 60, metronome: 'count-in' })
    const fast = rhythmSchedule(bar([0, 60]), { tempo: 120, metronome: 'count-in' })

    expect(fast.startsAt).toBe(slow.startsAt / 2)
    expect(fast.endsAt).toBe(slow.endsAt / 2)
  })

  it('offsets everything by the audio clock lead-in', () => {
    const schedule = rhythmSchedule(bar([0, 60]), {
      tempo: 60,
      metronome: 'throughout',
      from: 0.25,
    })

    expect(schedule.clicks[0]?.time).toBe(0.25)
    expect(schedule.hits[0]).toBe(4.25)
    expect(schedule.endsAt).toBe(8.25)
  })

  it('ends when the bar ends, not when the last impact lands', () => {
    // A rhythm whose last impact is early still has to run to the barline, or
    // the replay button comes back before the bar is over.
    const schedule = rhythmSchedule(bar([0]), { tempo: 60, metronome: 'count-in' })
    expect(schedule.endsAt).toBe(8)
  })

  it('schedules a bar with no impacts at all', () => {
    const schedule = rhythmSchedule(bar([]), { tempo: 90, metronome: 'count-in' })
    expect(schedule.hits).toEqual([])
    expect(schedule.endsAt).toBeGreaterThan(schedule.startsAt)
  })

  it('never sounds an impact before the count-in is over', () => {
    for (const tempo of [40, 60, 90, 120, 200]) {
      const schedule = rhythmSchedule(bar([0, 15, 20, 45, 200]), {
        tempo,
        metronome: 'throughout',
      })
      for (const hit of schedule.hits) {
        expect(hit).toBeGreaterThanOrEqual(schedule.startsAt)
        expect(hit).toBeLessThan(schedule.endsAt)
      }
    }
  })
})

describe('ticks and seconds', () => {
  it('agrees that a beat is a beat', () => {
    const schedule = rhythmSchedule(bar([0, TICKS_PER_BEAT]), {
      tempo: 60,
      metronome: 'count-in',
    })
    expect((schedule.hits[1] as number) - (schedule.hits[0] as number)).toBe(1)
  })
})

/* ------------------------------------------------------- a phrase of bars

   Melodic dictation counts in once and then plays several bars, and each note
   rings until the next one begins. Both are arithmetic, and both are the kind
   of thing that is silently wrong until somebody listens carefully. */

const phraseOf = (beats: number, ...bars: number[][]): Phrase => ({
  meter: { beats, unit: 4 },
  bars,
})

describe('scheduling a phrase', () => {
  it('counts in exactly one bar, however many follow it', () => {
    // What a count-in establishes is the metre — where beat one is — and that
    // does not need saying twice.
    const one = phraseSchedule(phraseOf(4, [0]), { tempo: 60, metronome: 'count-in' })
    const four = phraseSchedule(phraseOf(4, [0], [0], [0], [0]), {
      tempo: 60,
      metronome: 'count-in',
    })

    expect(one.clicks).toHaveLength(4)
    expect(four.clicks).toHaveLength(4)
    expect(four.startsAt).toBe(one.startsAt)
  })

  it('lays the impacts out across the bars', () => {
    const schedule = phraseSchedule(phraseOf(4, [0, 120], [0, 60]), {
      tempo: 60,
      metronome: 'count-in',
    })

    // One second per beat, four beats of count-in, then bar one at 4s and bar
    // two at 8s.
    expect(schedule.hits).toEqual([4, 6, 8, 9])
  })

  it('runs to the end of the last bar', () => {
    const schedule = phraseSchedule(phraseOf(4, [0], [0]), {
      tempo: 60,
      metronome: 'count-in',
    })
    expect(schedule.endsAt).toBe(12)
  })

  it('accents every barline when the click runs throughout', () => {
    // Not only the first: a player writing down two bars has to hear which
    // bar a note landed in.
    const schedule = phraseSchedule(phraseOf(3, [0], [0]), {
      tempo: 60,
      metronome: 'throughout',
    })

    const under = schedule.clicks.slice(3)
    expect(under.map((click) => click.accented)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it('leaves the bars silent when the click only counts in', () => {
    const schedule = phraseSchedule(phraseOf(4, [0], [0]), {
      tempo: 60,
      metronome: 'count-in',
    })
    expect(schedule.clicks).toHaveLength(4)
  })

  it("agrees with a single bar's schedule when there is only one", () => {
    const bar = { meter: { beats: 4, unit: 4 } as const, onsets: [0, 60, 180] }
    const options = { tempo: 90, metronome: 'throughout' as const, from: 0.5 }

    expect(phraseSchedule({ meter: bar.meter, bars: [bar.onsets] }, options)).toEqual(
      rhythmSchedule(bar, options),
    )
  })
})

describe('how long a melody note rings', () => {
  it('holds each note until the next one begins', () => {
    // Legato, and load-bearing: note values are not graded on the claim that a
    // held note and a note followed by a rest say the same thing. If one of
    // them damped early, that claim would be false to anyone listening.
    const durations = melodyDurations(phraseOf(4, [0, 60, 180]), { tempo: 60 })
    expect(durations).toEqual([1, 2, 1])
  })

  it('holds the last note to the end of the phrase', () => {
    expect(melodyDurations(phraseOf(4, [0]), { tempo: 60 })).toEqual([4])
    expect(melodyDurations(phraseOf(4, [0], [0]), { tempo: 60 })).toEqual([4, 4])
  })

  it('carries a note across a barline, which is why no answer needs a tie', () => {
    // Beat four of bar one to beat one of bar two: written as a note and a
    // rest, sounded as one held note. That the two are identical in the ear is
    // exactly what lets the spelling go ungraded.
    const durations = melodyDurations(phraseOf(4, [0, 180], [0]), { tempo: 60 })
    expect(durations).toEqual([3, 1, 4])
  })

  it('scales with the tempo', () => {
    expect(melodyDurations(phraseOf(4, [0, 60]), { tempo: 120 })).toEqual([0.5, 1.5])
  })
})
