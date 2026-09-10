import { TICKS_PER_BEAT } from '@/lib/music/meter'
import { phraseOnsets, phraseTicks, type Phrase } from '@/lib/music/phrase'
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

/**
 * The same, for a phrase of several bars.
 *
 * One count-in bar however many bars follow it: what a count-in establishes is
 * the metre — where beat one is — and that does not need saying twice.
 *
 * The click, when it runs throughout, accents the first beat of **every** bar
 * rather than only the first of the phrase. That is what makes the barlines
 * audible, and a player writing down two bars has to know which one a note
 * landed in.
 */
export function phraseSchedule(
  phrase: Phrase,
  { tempo, metronome, from = 0 }: ScheduleOptions,
): RhythmSchedule {
  const secondsPerBeat = 60 / tempo
  const { beats } = phrase.meter
  const startsAt = from + beats * secondsPerBeat
  const totalBeats = phraseTicks(phrase) / TICKS_PER_BEAT

  const countIn = Array.from({ length: beats }, (_, beat) => ({
    time: from + beat * secondsPerBeat,
    accented: beat === 0,
  }))

  const under =
    metronome === 'throughout'
      ? Array.from({ length: totalBeats }, (_, beat) => ({
          time: startsAt + beat * secondsPerBeat,
          accented: beat % beats === 0,
        }))
      : []

  return {
    clicks: [...countIn, ...under],
    hits: phraseOnsets(phrase).map(
      (tick) => startsAt + (tick / TICKS_PER_BEAT) * secondsPerBeat,
    ),
    startsAt,
    endsAt: startsAt + totalBeats * secondsPerBeat,
  }
}

/**
 * How long each note of a melody rings: until the next impact, and the last
 * one until the end of the phrase.
 *
 * **Legato, and that is load-bearing rather than a matter of taste.** Note
 * values are not graded, on the claim that a held note and a note followed by
 * a rest say the same thing. If a half note damped where a quarter and a rest
 * did not, that claim would be false the moment anybody listened: the spelling
 * would be audible, and a player could be marked right for writing down
 * something other than what they heard. Ringing every note into the next keeps
 * the two identical in sound, which is what makes them identical in grading.
 */
export function melodyDurations(
  phrase: Phrase,
  { tempo }: { tempo: number },
): readonly number[] {
  const secondsPerBeat = 60 / tempo
  const onsets = phraseOnsets(phrase)
  const end = phraseTicks(phrase)

  return onsets.map((tick, index) => {
    const next = onsets[index + 1] ?? end
    return ((next - tick) / TICKS_PER_BEAT) * secondsPerBeat
  })
}
