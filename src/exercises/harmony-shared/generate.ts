import { dealEvenly, type Random } from '@/lib/utils/seededRandom'

import { degreeOf, parseKeyKey, type Key } from '@/lib/music/key'
import {
  DEFAULT_METER,
  generateProgression,
  type Progression,
  type ProgressionSpec,
} from '@/lib/music/progression'
import { bassLine } from '@/lib/music/progression'
import { buildEvents, type ChordSpec, type HarmonicEvent } from '@/lib/music/harmony'
import { isDegreeAlteration, type Degree } from '@/lib/music/degree'
import { chromaticValue, pitch, type Pitch } from '@/lib/music/pitch'
import { voiceProgression } from '@/lib/music/satb'
import type { Satz } from '@/lib/music/voiceLeading'
import type { SatztechnikId } from '@/lib/music/satzmodell'

import type { HarmonySettings } from './settings'
import { FREE_WEIGHTS } from './settings'

/**
 * A harmony question: a progression, the four voices singing it, and the
 * tempo it goes by at.
 *
 * The `Satz` is **derived rather than stored** — `voiceProgression` is a pure
 * function of the progression and the weights, so keeping the voicing in the
 * question is caching, not state, and reading a row back out rebuilds exactly
 * the same four parts.
 */
export interface HarmonyQuestion {
  progression: Progression
  satz: Satz
  /** The four-chord cadence that fixes the key before the question is played. */
  establish: Satz | undefined
  tempo: number
}

export interface HarmonyRoundSpec extends HarmonySettings {
  /** What the round asks for. Fixed by the exercise, not by the level. */
  asks: 'bass'
}

const PLACEMENT_TRIES = 20

export function harmonySpec(settings: HarmonySettings): HarmonyRoundSpec {
  return { ...settings, asks: 'bass' }
}

export function keysOf(settings: HarmonySettings): readonly Key[] {
  return settings.keys.map(parseKeyKey).filter((key): key is Key => key !== undefined)
}

/**
 * A level's settings as the generator's own spec.
 *
 * Exported because the *grammar* can be exercised without the voicing search,
 * which is the expensive half: whether a level reaches every technique it
 * offers is a question about the blocks, and nothing about where four voices
 * end up can change the answer.
 */
export function progressionSpec(
  settings: HarmonySettings,
  keys: readonly Key[] = keysOf(settings),
): ProgressionSpec {
  return {
    keys,
    chords: settings.chords,
    cadences: settings.cadences as readonly SatztechnikId[],
    blocks: settings.blocks as readonly SatztechnikId[],
    freeWeight: FREE_WEIGHTS[settings.freedom],
    meter: DEFAULT_METER,
  }
}

/**
 * Four chords that say what key we are in.
 *
 * Münster's own ear-training paper prefixes its harmony question with a
 * Grundkadenz for exactly this reason: without one, writing a bass line as
 * *scale degrees* asks the player to find the tonic first, which is a
 * different and much harder question than the one being set. Played before the
 * progression and separated by a silence, it is a reference rather than part
 * of the answer.
 *
 * Built from the same `buildEvents` and voiced by the same search as any other
 * progression, so it cannot come out in a different idiom from the question it
 * introduces.
 */
const ESTABLISHING: readonly ChordSpec[] = [
  { degree: 1, inversion: 0, beats: 2 },
  { degree: 4, inversion: 0, beats: 2 },
  { degree: 5, inversion: 0, seventh: true, beats: 2 },
  { degree: 1, inversion: 0, beats: 4 },
]

export function establishingCadence(key: Key): Satz | undefined {
  const events: HarmonicEvent[] = []
  for (const spec of ESTABLISHING) {
    const built = buildEvents(key, spec)
    if (built === undefined) return undefined
    events.push(...built)
  }

  const progression: Progression = {
    key,
    meter: DEFAULT_METER,
    events,
    analysis: [],
    constraints: [],
  }
  return voiceProgression(progression)
}

export function buildQuestion(
  random: Random,
  spec: HarmonyRoundSpec,
  key: Key,
): HarmonyQuestion | undefined {
  for (let tries = 0; tries < PLACEMENT_TRIES; tries += 1) {
    const progression = generateProgression(random, progressionSpec(spec, [key]))
    if (progression === undefined) continue

    const satz = voiceProgression(progression, { constraints: progression.constraints })
    if (satz === undefined) continue

    return {
      progression,
      satz,
      establish: spec.establish ? establishingCadence(key) : undefined,
      tempo: spec.tempo,
    }
  }
  return undefined
}

export function generateRound(random: Random, spec: HarmonyRoundSpec): HarmonyQuestion[] {
  const keys = keysOf(spec)
  if (keys.length === 0) return []

  // Deal the keys rather than sampling them, so a round of ten does not ask
  // about E flat four times and never mention D — the same reason
  // `dealEvenly` exists for interval and chord rounds.
  const deck = dealEvenly(random, keys, spec.questionsPerRound)

  const questions: HarmonyQuestion[] = []
  for (const key of deck) {
    const question = buildQuestion(random, spec, key)
    if (question !== undefined) questions.push(question)
  }
  return questions
}

/**
 * The octave the player's bass line is drawn in.
 *
 * **Chosen so the seven degrees land where a bass actually sings.** Put the
 * tonic at a fixed octave and the run comes out wherever the letter happens to
 * fall: in B♭ major the fifth degree was an F above the bass staff, carrying a
 * ledger line on a key face that had no business needing one. Anchoring the
 * tonic near the bottom of the bass's compass instead keeps all seven inside
 * the staff whatever key it is, which is what makes the keys readable at a
 * glance and the written line look like a bass part.
 *
 * Nothing about the *answer* depends on it — the octave is not graded, see
 * `bassDegrees` — so this is purely where the ink goes.
 */
const BASS_ANCHOR = chromaticValue(pitch('A', 0, 2))

export function bassTonic(key: Key): Pitch {
  let best = { ...key.tonic, octave: 1 }
  for (let octave = 1; octave <= 4; octave += 1) {
    const candidate: Pitch = { ...key.tonic, octave }
    if (
      Math.abs(chromaticValue(candidate) - BASS_ANCHOR) <
      Math.abs(chromaticValue(best) - BASS_ANCHOR)
    ) {
      best = candidate
    }
  }
  return best
}

/* ------------------------------------------------------------- the answer */

/**
 * The bass line as scale degrees — what the first exercise asks for.
 *
 * **Without an octave, and that is a decision rather than a shortcut.** Which
 * octave the bass sits in is a fact about the voicing the search settled on,
 * not about the harmony, so asking for it would grade the player on something
 * the question never posed. A degree and an alteration is the whole of what
 * there is to hear.
 */
export function bassDegrees(progression: Progression): readonly Degree[] | undefined {
  const degrees: Degree[] = []

  for (const note of bassLine(progression)) {
    const found = degreeOf(progression.key, note)
    if (found === undefined || !isDegreeAlteration(found.alteration)) return undefined
    degrees.push({ number: found.number, alteration: found.alteration })
  }

  return degrees
}

/** How many notes the bass line has, which is how many the player writes. */
export function bassLength(progression: Progression): number {
  return bassLine(progression).length
}
