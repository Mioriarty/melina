import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

import { degreeOf, parseKeyKey, type Key } from '@/lib/music/key'
import {
  DEFAULT_METER,
  generateProgression,
  type Progression,
  type ProgressionSpec,
  type VoicingConstraint,
} from '@/lib/music/progression'
import { chordNotes, CHORD_MEMBERS, type ChordMember } from '@/lib/music/chord'
import { eventChord } from '@/lib/music/harmony'
import type { RuleId } from '@/lib/music/voiceLeading'

import { bassLine } from '@/lib/music/progression'
import { buildEvents, type ChordSpec, type HarmonicEvent } from '@/lib/music/harmony'
import { isDegreeAlteration, type Degree } from '@/lib/music/degree'
import { chromaticValue, pitch, type Pitch } from '@/lib/music/pitch'
import { voiceProgression } from '@/lib/music/satb'
import type { Satz } from '@/lib/music/satbVoicing'
import type { SatztechnikId } from '@/lib/music/satzmodell'

import type { CadenceSettings, HarmonySettings } from './settings'
import { FREE_WEIGHTS, OPENING_LAGEN } from './settings'

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

export interface CadenceRoundSpec extends CadenceSettings {
  asks: 'satz'
}

export function cadenceSpec(settings: CadenceSettings): CadenceRoundSpec {
  return { ...settings, asks: 'satz' }
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

/* ------------------------------------------------- writing one down, in four parts */

/**
 * A cadence to be written out in four parts.
 *
 * The progression is the question and the `model` is the search's own answer to
 * it — kept because the question has to be *playable* once it is revealed, and
 * because a progression the search cannot set is a question nobody could answer.
 * It is not "the right answer": there is no single right answer, which is the
 * whole reason this exercise is graded by rules rather than by equality.
 *
 * **`rules` rides on the question rather than beside it**, the same move
 * `ChordQuestion.asks` makes: what an answer is held to is a fact about the
 * question that was asked, and a verdict that had to be handed the level's
 * settings separately is a verdict that can be given the wrong ones.
 */
export interface CadenceQuestion {
  progression: Progression
  /** Which chord member the opening soprano must sing — what the prompt names. */
  lage: ChordMember
  /** The voicing search's own setting: what the question sounds like. */
  model: Satz
  /** The voice-leading rules this answer is marked against. */
  rules: readonly RuleId[]
  tempo: number
}

/**
 * The opening Lage as the voicing search understands it: a note for the top.
 *
 * Resolved here rather than carried as a member index, for the reason
 * `sopranoNote` resolves a block's own constraint — the search is handed a
 * pitch class and asked to put it on top, and never has to know what a chord
 * member is.
 */
export function openingConstraint(
  progression: Progression,
  lage: ChordMember,
): VoicingConstraint | undefined {
  const opening = progression.events[0]
  if (opening === undefined) return undefined

  const chord = eventChord(opening)
  if (chord === undefined) return undefined

  const note = chordNotes(chord.root, chord.quality)?.[CHORD_MEMBERS.indexOf(lage)]
  return note === undefined ? undefined : { event: 0, soprano: note }
}

/**
 * A progression's own voicing constraints, with the prompt's Lage on top.
 *
 * **The opening block already has an opinion about the soprano, and the prompt
 * outranks it.** `eroeffnung-tonika` asks for the root on top — which is
 * Oktavlage — and that is a good default for a progression that is going to be
 * *heard*, where a tonic in the soprano opens the key clearly. It is exactly
 * what a written exam varies, so here it is replaced rather than respected.
 *
 * The block is still an opening tonic: which member sits on top is a fact about
 * the voicing and not about the technique, which is why `RelativeEvent.soprano`
 * was always a preference the search honours rather than part of the schema.
 *
 * One function because two callers need it — the generator and the way back out
 * of the attempt log — and a row that rebuilt its chords under different
 * constraints would disagree with the notation it produced.
 */
export function cadenceConstraints(
  progression: Progression,
  lage: ChordMember,
): readonly VoicingConstraint[] | undefined {
  const opening = openingConstraint(progression, lage)
  if (opening === undefined) return undefined
  return [...progression.constraints.filter((c) => c.event !== 0), opening]
}

export function buildCadence(
  random: Random,
  spec: CadenceRoundSpec,
  key: Key,
): CadenceQuestion | undefined {
  const lagen = spec.lagen.length > 0 ? spec.lagen : OPENING_LAGEN

  for (let tries = 0; tries < PLACEMENT_TRIES; tries += 1) {
    const progression = generateProgression(random, progressionSpec(spec, [key]))
    if (progression === undefined) continue

    const lage = randomPick(random, lagen as readonly [ChordMember, ...ChordMember[]])
    const constraints = cadenceConstraints(progression, lage)
    if (constraints === undefined) continue

    const model = voiceProgression(progression, { constraints })
    if (model === undefined) continue

    return { progression, lage, model, rules: spec.rules, tempo: spec.tempo }
  }
  return undefined
}

export function generateCadenceRound(
  random: Random,
  spec: CadenceRoundSpec,
): CadenceQuestion[] {
  const keys = keysOf(spec)
  if (keys.length === 0) return []

  const deck = dealEvenly(random, keys, spec.questionsPerRound)

  const questions: CadenceQuestion[] = []
  for (const key of deck) {
    const question = buildCadence(random, spec, key)
    if (question !== undefined) questions.push(question)
  }
  return questions
}

/** The bass line a cadence gives the player, at the octaves the model sings it. */
export function givenBass(question: CadenceQuestion): readonly Pitch[] {
  return question.model.voicings.map((voicing) => voicing.bass)
}
