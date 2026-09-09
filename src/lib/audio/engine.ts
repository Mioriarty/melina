import type { DrumMachine, Soundfont as SmplrInstrument } from 'smplr'

import { isMelodic, type PlayDirection } from '@/lib/music/direction'
import { midiNumber, type Pitch } from '@/lib/music/pitch'
import type { Rhythm } from '@/lib/music/rhythm'

import { rhythmSchedule, type MetronomeMode } from './rhythmSchedule'

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

  // Cut off anything still ringing, so a quick replay does not stack up.
  instrument.stop()

  pitches.forEach((pitch, index) => {
    instrument.start({
      note: midiNumber(pitch),
      time: start + index * gap,
      duration,
      velocity: 92,
    })
  })
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
  // over each other. Straight on the resolved kit rather than through
  // `stopPlayback`, which stops in a promise callback that could land *after*
  // the notes below have been scheduled and silence them instead.
  kit.stop()

  const schedule = rhythmSchedule(rhythm, {
    tempo,
    metronome,
    from: context.currentTime + LEAD_IN,
  })

  for (const beat of schedule.clicks) {
    kit.start({
      note: beat.accented ? CLICK_ACCENT : CLICK_BEAT,
      time: beat.time,
      velocity: beat.accented ? ACCENT_VELOCITY : BEAT_VELOCITY,
    })
  }
  for (const time of schedule.hits) {
    kit.start({ note: SNARE, time, velocity: SNARE_VELOCITY })
  }
}

/** Silence whatever is currently sounding. */
export function stopPlayback(): void {
  void player?.then((instrument) => instrument.stop()).catch(() => undefined)
  void drums?.then((kit) => kit.stop()).catch(() => undefined)
}
