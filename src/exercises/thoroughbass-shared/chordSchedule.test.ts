import { describe, expect, it } from 'vitest'

import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { pitch, pitchKey } from '@/lib/music/pitch'

import { chordSchedule } from './chordSchedule'
import { describeEvent, type ThoroughbassQuestion } from './generate'

/**
 * When a thoroughbass question sounds.
 *
 * Pure arithmetic, so it can be checked without a network or an AudioContext —
 * which is the only reason any of this is testable at all, and it matters:
 * sounding every chord of a question at once is a cluster rather than a
 * reading, and that is exactly what it used to do.
 */
const fig = (key: string) => parseFigureKey(key) as Figure

function question(events: readonly [string, readonly string[]][]): ThoroughbassQuestion {
  return {
    keySignature: '0',
    events: events.map(([bass, figures]) => {
      const at = /^([A-G])(b|#)?(\d)$/.exec(bass)
      const built = describeEvent(
        pitch(
          (at?.[1] ?? 'C') as 'C',
          at?.[2] === 'b' ? -1 : at?.[2] === '#' ? 1 : 0,
          Number(at?.[3] ?? 3),
        ),
        '0',
        figures.map(fig),
      )
      if (built === undefined)
        throw new Error(`${bass} ${figures.join('-')} will not spell`)
      return built
    }),
  }
}

const at = (schedule: ReturnType<typeof chordSchedule>, pitchName: string) =>
  schedule.filter((note) => pitchKey(note.pitch) === pitchName)

describe('one chord', () => {
  it('strikes everything together', () => {
    const schedule = chordSchedule(question([['G3', ['7']]]))
    expect(schedule.length).toBeGreaterThan(1)
    expect(new Set(schedule.map((note) => note.at))).toEqual(new Set([0]))
  })

  it('rings longer than one that has something after it', () => {
    const alone = chordSchedule(question([['G3', ['7']]]))
    const first = chordSchedule(
      question([
        ['G3', ['7']],
        ['C3', ['']],
      ]),
    )
    expect(alone[0]?.duration).toBeGreaterThan(first[0]?.duration ?? 0)
  })
})

describe('a bass line', () => {
  const line = () =>
    chordSchedule(
      question([
        ['C3', ['']],
        ['E3', ['6']],
        ['G3', ['7']],
      ]),
    )

  it('sounds every chord, one after another', () => {
    const starts = [...new Set(line().map((note) => note.at))].sort((a, b) => a - b)
    expect(starts).toHaveLength(3)
    // Evenly spaced, and in order.
    const gaps = starts.slice(1).map((time, i) => time - (starts[i] as number))
    expect(new Set(gaps.map((gap) => gap.toFixed(3))).size).toBe(1)
  })

  it('strikes each of its bass notes, because each one is new', () => {
    const schedule = line()
    const onsets = ['C3', 'E3', 'G3'].map((name) => {
      const struck = at(schedule, name)
      expect(struck, name).toHaveLength(1)
      return struck[0]?.at ?? -1
    })
    // In the order they are written, and each after the one before it.
    expect(onsets).toEqual([...onsets].sort((a, b) => a - b))
    expect(new Set(onsets).size).toBe(3)
  })

  it('leaves nothing out', () => {
    const asked = question([
      ['C3', ['']],
      ['E3', ['6']],
      ['G3', ['7']],
    ])
    const wanted = asked.events.flatMap((event) => [
      event.bass,
      ...event.chords.flat(),
    ]).length
    expect(chordSchedule(asked)).toHaveLength(wanted)
  })
})

describe('a suspension', () => {
  const held = () => chordSchedule(question([['G3', ['4', '3']]]))

  it('strikes the bass once and rings it under both chords', () => {
    // **The whole of what makes it a suspension.** Re-striking the bass for
    // the resolution would say the opposite: that it moved.
    const bass = at(held(), 'G3')
    expect(bass).toHaveLength(1)
    expect(bass[0]?.at).toBe(0)

    const second = Math.max(...held().map((note) => note.at))
    expect(second).toBeGreaterThan(0)
    // It is still ringing when the resolution arrives.
    expect((bass[0]?.at ?? 0) + (bass[0]?.duration ?? 0)).toBeGreaterThan(second)
  })

  it('sounds the held chord before its resolution', () => {
    const starts = [...new Set(held().map((note) => note.at))].sort((a, b) => a - b)
    expect(starts).toHaveLength(2)
  })

  it('sounds both chords in full', () => {
    const asked = question([['G3', ['4', '3']]])
    const notes = asked.events[0]?.chords.flat().length ?? 0
    // Every chord note, plus the one bass.
    expect(chordSchedule(asked)).toHaveLength(notes + 1)
  })
})
