import type { DrumMachine, Soundfont as SmplrInstrument, StopFn } from 'smplr'

import { isMelodic, type PlayDirection } from '@/lib/music/direction'
import { midiNumber, type Pitch } from '@/lib/music/pitch'
import type { Phrase } from '@/lib/music/phrase'
import type { Rhythm } from '@/lib/music/rhythm'

import {
  melodyDurations,
  phraseSchedule,
  rhythmSchedule,
  type MetronomeMode,
} from './rhythmSchedule'

/**
 * Playback.
 *
 * Sampled, not synthesised: ear training is about timbre as much as pitch,
 * and a sine wave teaches you to recognise a sine wave. One instrument, a
 * Steinway with four velocity layers — what a piece is heard on is not one of
 * the things melina asks anyone to decide.
 *
 * smplr streams the samples from a CDN, so the piano is loaded once, lazily,
 * and kept for the life of the page. The service worker caches those
 * requests, which is what lets it still work offline once practised.
 *
 * Browsers refuse to start an AudioContext without a user gesture, so the
 * context is created on first use — by which time the player has pressed
 * "Start round" — and resumed defensively before every note, since a context
 * can be suspended again when a tab is backgrounded.
 */

/**
 * smplr's player surface, imported as a type so it is erased from the
 * bundle. Declaring it by hand instead would mean TypeScript could not catch
 * an upstream API change — which is how `output.setVolume` went on being
 * called here after it had been deprecated.
 */
type SampledInstrument = SmplrInstrument

let audioContext: AudioContext | undefined
let player: Promise<SampledInstrument> | undefined
let drums: Promise<DrumMachine> | undefined

/**
 * Everything currently sounding *or still waiting to sound*.
 *
 * smplr only registers a voice when its scheduler dispatches the note, which
 * it does around 200ms ahead of time. `instrument.stop()` walks the voices,
 * so it silences what has already begun and leaves everything further out
 * queued to fire exactly on time — the rest of a scale, the second note of a
 * melodic interval, a whole bar of drums after the count-in. Leaving a
 * question or a page therefore used to take the sound with it only if the
 * sound happened to be nearly over.
 *
 * The stop function `start` hands back is the one that also drops the note
 * from that queue, so each scheduled note keeps its own and `stopPlayback`
 * calls all of them. One list across both instruments: a rhythm and a piano
 * are never wanted at once, and stopping is stopping.
 */
let sounding: readonly StopFn[] = []

/** Trimmed so the piano is neither timid nor startling. */
const GAIN = 1
/** Seconds a single note of an interval sounds for. */
const NOTE_DURATION = 1.9

/** Gap between the two notes of a melodic interval, in seconds. */
const MELODIC_GAP = 0.62
/**
 * Gap between the notes of a scale, and how long each one rings.
 *
 * Faster than a melodic interval on purpose: eight notes at interval pace is
 * a series of separate notes rather than a scale, and hearing a mode depends
 * on hearing the shape whole. The notes ring slightly past the next one, the
 * way a played scale does.
 */
const SCALE_GAP = 0.4
const SCALE_NOTE_DURATION = 0.6
/** Lead-in, so the first note is never clipped by scheduling jitter. */
const LEAD_IN = 0.06

export function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext()
  return audioContext
}

async function createPlayer(): Promise<SampledInstrument> {
  const context = getAudioContext()
  const { SplendidGrandPiano } = await import('smplr')

  const instrument = SplendidGrandPiano(context) as unknown as SampledInstrument
  await instrument.ready
  // `setVolume` is deprecated upstream; the property is the current API.
  instrument.output.volume = GAIN * 100
  return instrument
}

/**
 * Load the piano, reusing the in-flight promise if one is already loading.
 * Failures are not cached, so a dropped connection can be retried.
 */
export function loadInstrument(): Promise<SampledInstrument> {
  player ??= createPlayer().catch((error: unknown) => {
    player = undefined
    throw error
  })
  return player
}

/**
 * Create and resume the AudioContext.
 *
 * Must be called from inside a user gesture — browsers start a context
 * suspended otherwise and refuse to resume it. "Start round" is that gesture,
 * which is why the first question can then play by itself.
 */
export async function unlockAudio(): Promise<void> {
  const context = getAudioContext()
  if (context.state === 'suspended') await context.resume()
}

export class PlaybackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaybackError'
  }
}

/**
 * Sound an interval.
 *
 * `pitches` arrive in the order they should be heard; a harmonic interval
 * gets both at the same instant, a melodic one gets them a beat apart.
 * Resolves once the notes have been *scheduled*, not once they finish, so the
 * caller can re-enable its play button immediately.
 */
export async function playInterval(
  pitches: readonly [Pitch, Pitch],
  direction: PlayDirection,
): Promise<void> {
  await playSequence(pitches, {
    gap: isMelodic(direction) ? MELODIC_GAP : 0,
    duration: NOTE_DURATION,
  })
}

/**
 * Sound a scale, one note after another.
 *
 * `pitches` arrive in the order they should be heard, so a descending scale
 * is simply passed in reversed.
 */
export async function playScale(pitches: readonly Pitch[]): Promise<void> {
  await playSequence(pitches, { gap: SCALE_GAP, duration: SCALE_NOTE_DURATION })
}

/**
 * Schedule a run of notes.
 *
 * A `gap` of zero sounds them all at once, which is what a harmonic interval
 * is. Resolves once the notes have been *scheduled*, not once they finish, so
 * the caller can re-enable its play button immediately.
 */
async function playSequence(
  pitches: readonly Pitch[],
  { gap, duration }: { gap: number; duration: number },
): Promise<void> {
  const instrument = await loadInstrument()
  const context = getAudioContext()

  // A context can be suspended by the browser at any point after creation.
  if (context.state === 'suspended') await context.resume()

  const start = context.currentTime + LEAD_IN

  // Cut off anything still ringing or still queued, so a quick replay does
  // not stack up. After the awaits and immediately before scheduling, so a
  // second call cannot silence the notes this one is about to lay down.
  stopPlayback()

  sounding = pitches.map((pitch, index) =>
    instrument.start({
      note: midiNumber(pitch),
      time: start + index * gap,
      duration,
      velocity: 92,
    }),
  )
}

/* ------------------------------------------------------------------ rhythm

   Rhythmic dictation needs a drum to play the rhythm on and a click to count
   it in. Both come from one sampled kit, which is a few hundred kilobytes
   rather than the piano's tens of megabytes. */

/**
 * The kit. The LinnDrum rather than the TR-808: its drums are sampled acoustic
 * ones, so the snare has a real transient and a short decay, and adjacent
 * sixteenths stay separate instead of smearing into each other.
 */
const DRUM_MACHINE = 'LM-2'

/**
 * **Named sample by sample, never by group.**
 *
 * smplr resolves a bare group name — `snare` — to whichever variation happens
 * to come first in the kit's manifest, and on the TR-808 that is `snare/sd0000`:
 * the one with both tone and snap wound down to zero. Measured, it has a
 * spectral centroid of 243 Hz against the kick's 128 Hz and the same
 * low-to-high energy ratio, which is to say it *is* a kick to any ear, and it
 * was what this played for its first draft. Every name here is therefore a
 * whole sample name, and adding one means picking the variation deliberately.
 */
const SNARE = 'snare-m'
/** The count-in. Sidesticks: a click, plainly not a drum being struck. */
const CLICK_ACCENT = 'stick-h'
const CLICK_BEAT = 'stick-m'

/** The rhythm is the foreground; the click sits behind it. */
const SNARE_VELOCITY = 110
const ACCENT_VELOCITY = 72
const BEAT_VELOCITY = 48

/**
 * Load the drum kit.
 *
 * Small enough that a rhythm exercise can fetch it up front — it plays by
 * itself, the way the hearing exercises do. Cached at runtime by the service
 * worker, never precached, for the same reason as the piano.
 */
export function loadDrums(): Promise<DrumMachine> {
  drums ??= (async () => {
    const context = getAudioContext()
    const { DrumMachine: Kit } = await import('smplr')

    const kit = Kit(context, { instrument: DRUM_MACHINE })
    await kit.ready
    return kit
  })().catch((error: unknown) => {
    // Failures are not cached, so a dropped connection can be retried.
    drums = undefined
    throw error
  })

  return drums
}

export interface RhythmPlaybackOptions {
  /** Beats per minute. */
  tempo: number
  metronome: MetronomeMode
}

/**
 * Count a bar, then play the rhythm on a snare.
 *
 * Resolves once everything has been *scheduled*, not once it has finished, so
 * the replay control comes back immediately — the same contract as
 * `playSequence`.
 */
export async function playRhythm(
  rhythm: Rhythm,
  { tempo, metronome }: RhythmPlaybackOptions,
): Promise<void> {
  const kit = await loadDrums()
  const context = getAudioContext()

  // A context can be suspended by the browser at any point after creation.
  if (context.state === 'suspended') await context.resume()

  // Cut off anything still counting, so a quick replay does not play two bars
  // over each other. `stopPlayback` is synchronous, so it cannot land after
  // the notes below have been scheduled and silence them instead.
  stopPlayback()

  const schedule = rhythmSchedule(rhythm, {
    tempo,
    metronome,
    from: context.currentTime + LEAD_IN,
  })

  sounding = [
    ...schedule.clicks.map((beat) =>
      kit.start({
        note: beat.accented ? CLICK_ACCENT : CLICK_BEAT,
        time: beat.time,
        velocity: beat.accented ? ACCENT_VELOCITY : BEAT_VELOCITY,
      }),
    ),
    ...schedule.hits.map((time) =>
      kit.start({ note: SNARE, time, velocity: SNARE_VELOCITY }),
    ),
  ]
}

/* ------------------------------------------------------------------ degrees

   Scale degree identification puts a key in the ear and then asks what was
   heard against it, so a question is two things in a row: a chord, and a
   melody with no rhythm to it. */

/** How long the tonic chord rings, and when the melody follows it. */
const CHORD_DURATION = 1.8
const CHORD_TO_MELODY = 2.15
/** The chord is context; the melody is the question, and sits in front of it. */
const CHORD_VELOCITY = 78
const MELODY_VELOCITY = 95
/**
 * The melody's pace. There is deliberately no rhythm in it — what is being
 * asked is *which note*, and a rhythm on top would be a second question — so
 * the notes are evenly spaced and each rings a little past the next.
 */
const DEGREE_GAP = 0.62
const DEGREE_NOTE_DURATION = 0.85

/**
 * Sound a key, then a melody in it.
 *
 * The chord comes first and finishes before the melody starts: it is there to
 * put the tonic in the ear, and a chord still ringing under the first note
 * would make that note harder to hear rather than easier.
 *
 * Resolves once everything has been *scheduled*, not once it has finished, so
 * the replay control comes back immediately.
 */
export async function playDegrees(
  chord: readonly Pitch[],
  melody: readonly Pitch[],
): Promise<void> {
  const instrument = await loadInstrument()
  const context = getAudioContext()

  // A context can be suspended by the browser at any point after creation.
  if (context.state === 'suspended') await context.resume()

  const start = context.currentTime + LEAD_IN

  // After the awaits and immediately before scheduling, so a second call
  // cannot silence the notes this one is about to lay down.
  stopPlayback()

  sounding = [
    ...chord.map((pitch) =>
      instrument.start({
        note: midiNumber(pitch),
        time: start,
        duration: CHORD_DURATION,
        velocity: CHORD_VELOCITY,
      }),
    ),
    ...melody.map((pitch, index) =>
      instrument.start({
        note: midiNumber(pitch),
        time: start + CHORD_TO_MELODY + index * DEGREE_GAP,
        duration: DEGREE_NOTE_DURATION,
        velocity: MELODY_VELOCITY,
      }),
    ),
  ]
}

/* ------------------------------------------------------- melodic dictation

   The two halves at once, and the first question in the app that needs two
   instruments to sound: a piano for the notes, and the kit's sidesticks to
   count the bar in. */

/** The melody is the question; the click behind it is only the pulse. */
const MELODY_NOTE_VELOCITY = 95

/**
 * Count a bar, then play a melody in time.
 *
 * **Every note rings until the next one begins** — see `melodyDurations`. That
 * is what makes "a held note and a note followed by a rest are the same answer"
 * true in the ear as well as in the grading: if the spelling were audible, a
 * player could be marked right for writing down something they did not hear.
 *
 * Two instruments at once, which nothing else here needs. They share the one
 * list of scheduled notes, because stopping is stopping — a melody and its own
 * count-in are never wanted separately.
 *
 * Resolves once everything has been *scheduled*, not once it has finished, so
 * the replay control comes back immediately.
 */
export async function playMelody(
  phrase: Phrase,
  pitches: readonly Pitch[],
  { tempo, metronome }: RhythmPlaybackOptions,
): Promise<void> {
  const [instrument, kit] = await Promise.all([loadInstrument(), loadDrums()])
  const context = getAudioContext()

  // A context can be suspended by the browser at any point after creation.
  if (context.state === 'suspended') await context.resume()

  // After the awaits and immediately before scheduling, so a second call
  // cannot silence the notes this one is about to lay down.
  stopPlayback()

  const from = context.currentTime + LEAD_IN
  const schedule = phraseSchedule(phrase, { tempo, metronome, from })
  const durations = melodyDurations(phrase, { tempo })

  sounding = [
    ...schedule.clicks.map((beat) =>
      kit.start({
        note: beat.accented ? CLICK_ACCENT : CLICK_BEAT,
        time: beat.time,
        velocity: beat.accented ? ACCENT_VELOCITY : BEAT_VELOCITY,
      }),
    ),
    ...schedule.hits.flatMap((time, index) => {
      const pitch = pitches[index]
      // One note per impact; a phrase and its melody cannot disagree, but the
      // types do not know that and a missing note must not stop the bar.
      if (pitch === undefined) return []
      return [
        instrument.start({
          note: midiNumber(pitch),
          time,
          duration: durations[index] ?? SCALE_NOTE_DURATION,
          velocity: MELODY_NOTE_VELOCITY,
        }),
      ]
    }),
  ]
}

/**
 * Fetch what melodic dictation plays on: the piano *and* the kit.
 *
 * Both, because it counts itself in and then plays pitches. The kit is a few
 * hundred kilobytes and the piano tens of megabytes, so this is the most
 * expensive preload in the app — and it is still a preload, because the
 * exercise plays by itself the moment a question appears.
 */
export function loadMelodyInstruments(): Promise<unknown> {
  return Promise.all([loadInstrument(), loadDrums()])
}

/**
 * Silence whatever is sounding, and drop whatever is queued to sound next.
 *
 * Synchronous on purpose — it is called from a click handler and from effect
 * cleanups, where anything deferred to a promise could land after the next
 * question has already scheduled itself and cut *that* off instead.
 */
export function stopPlayback(): void {
  const pending = sounding
  sounding = []
  for (const stop of pending) stop()
}
