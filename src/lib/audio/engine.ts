import type { Soundfont as SmplrInstrument } from 'smplr'

import { isMelodic, type PlayDirection } from '@/lib/music/direction'
import { midiNumber, type Pitch } from '@/lib/music/pitch'

import { getInstrument, type InstrumentId } from './instruments'

/**
 * Playback.
 *
 * smplr streams real samples from a CDN, so an instrument is loaded once,
 * lazily, and kept for the life of the page. The service worker caches those
 * requests, which is what lets a practised instrument still work offline.
 *
 * Browsers refuse to start an AudioContext without a user gesture, so the
 * context is created on first use — by which time the player has pressed
 * "Start round" — and resumed defensively before every note, since a context
 * can be suspended again when a tab is backgrounded.
 */

/**
 * smplr's instrument surface, imported as a type so it is erased from the
 * bundle. Every instrument shares this shape, so the harp and the piano are
 * interchangeable here. Declaring it by hand instead would mean TypeScript
 * could not catch an upstream API change.
 */
type SampledInstrument = SmplrInstrument

let audioContext: AudioContext | undefined
const players = new Map<InstrumentId, Promise<SampledInstrument>>()

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

async function createPlayer(id: InstrumentId): Promise<SampledInstrument> {
  const context = getAudioContext()
  const { SplendidGrandPiano, Soundfont } = await import('smplr')

  const player =
    id === 'piano'
      ? SplendidGrandPiano(context)
      : Soundfont(context, { instrument: 'orchestral_harp', kit: 'MusyngKite' })

  const instrument = player as unknown as SampledInstrument
  await instrument.ready
  // `setVolume` is deprecated upstream; the property is the current API.
  instrument.output.volume = getInstrument(id).gain * 100
  return instrument
}

/**
 * Load an instrument, reusing the in-flight promise if one is already loading.
 * Failures are not cached, so a dropped connection can be retried.
 */
export function loadInstrument(id: InstrumentId): Promise<SampledInstrument> {
  const existing = players.get(id)
  if (existing !== undefined) return existing

  const pending = createPlayer(id).catch((error: unknown) => {
    players.delete(id)
    throw error
  })
  players.set(id, pending)
  return pending
}

/** Begin fetching an instrument without waiting for it. */
export function preloadInstrument(id: InstrumentId): void {
  void loadInstrument(id).catch(() => {
    // Surfaced when playback is actually attempted, not here.
  })
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
  instrumentId: InstrumentId,
): Promise<void> {
  const { duration } = getInstrument(instrumentId)
  await playSequence(pitches, instrumentId, {
    gap: isMelodic(direction) ? MELODIC_GAP : 0,
    duration,
  })
}

/**
 * Sound a scale, one note after another.
 *
 * `pitches` arrive in the order they should be heard, so a descending scale
 * is simply passed in reversed.
 */
export async function playScale(
  pitches: readonly Pitch[],
  instrumentId: InstrumentId,
): Promise<void> {
  await playSequence(pitches, instrumentId, {
    gap: SCALE_GAP,
    duration: SCALE_NOTE_DURATION,
  })
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
  instrumentId: InstrumentId,
  { gap, duration }: { gap: number; duration: number },
): Promise<void> {
  const instrument = await loadInstrument(instrumentId)
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

/** Silence whatever is currently sounding. */
export function stopPlayback(): void {
  for (const pending of players.values()) {
    void pending.then((instrument) => instrument.stop()).catch(() => undefined)
  }
}
