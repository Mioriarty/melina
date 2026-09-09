import { TICKS_PER_BEAT } from '@/lib/music/meter'
import type { Rhythm } from '@/lib/music/rhythm'

/**
 * When everything in a rhythm question sounds.
 *
 * Pure arithmetic, kept out of `engine.ts` so it can be checked without a
 * network or an AudioContext: the samples are fetched from a CDN and the
 * browser will not start a context outside a user gesture, so the scheduling
 * would otherwise be the one part of playback nothing could test.
 */

/**
 * Whether the click keeps going under the bar being asked about.
 *
 * A real difficulty axis rather than a preference: counted in and then left
 * alone, you have to hold the pulse yourself, which is most of what rhythmic
 * dictation is. With the click running underneath, the bar is measured against
 * something you can hear.
 */
export type MetronomeMode = 'count-in' | 'throughout'

export const METRONOME_MODES: readonly MetronomeMode[] = ['count-in', 'throughout']

export function isMetronomeMode(value: string): value is MetronomeMode {
  return (METRONOME_MODES as readonly string[]).includes(value)
}

export interface ScheduledClick {
  /** Seconds from the start of playback. */
  time: number
  /** The first beat of a bar, which the click marks so the bar can be felt. */
  accented: boolean
}

export interface RhythmSchedule {
  clicks: readonly ScheduledClick[]
  /** Seconds from the start of playback, one per impact. */
  hits: readonly number[]
  /** When the counted-in bar ends and the rhythm begins. */
  startsAt: number
  /** When the last beat of the rhythm's bar passes. */
  endsAt: number
}

export interface ScheduleOptions {
  /** Beats per minute. */
  tempo: number
  metronome: MetronomeMode
  /** Seconds to offset everything by, for the audio clock's lead-in. */
  from?: number
}

/**
 * A full count-in bar, then the rhythm.
 *
 * The count-in is a whole bar rather than a couple of beats because what it
 * establishes is not the tempo but the *metre*: where beat one is, which is
 * the thing every answer is measured from.
 */
export function rhythmSchedule(
  rhythm: Rhythm,
  { tempo, metronome, from = 0 }: ScheduleOptions,
): RhythmSchedule {
  const secondsPerBeat = 60 / tempo
  const { beats } = rhythm.meter
  const startsAt = from + beats * secondsPerBeat

  const countIn = Array.from({ length: beats }, (_, beat) => ({
    time: from + beat * secondsPerBeat,
    accented: beat === 0,
  }))

  const under =
    metronome === 'throughout'
      ? Array.from({ length: beats }, (_, beat) => ({
          time: startsAt + beat * secondsPerBeat,
          accented: beat === 0,
        }))
      : []

  return {
    clicks: [...countIn, ...under],
    hits: rhythm.onsets.map(
      (tick) => startsAt + (tick / TICKS_PER_BEAT) * secondsPerBeat,
    ),
    startsAt,
    endsAt: startsAt + beats * secondsPerBeat,
  }
}
