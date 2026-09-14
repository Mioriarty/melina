import type { AttemptFilter } from '@/lib/db/progress'
import type { HarmonyAttempt } from '@/lib/db/attemptQuestion'
import { keyKey, parseKeyKey, type Key } from '@/lib/music/key'
import { DEFAULT_METER } from '@/lib/music/progression'
import { parseProgression, progressionKey } from '@/lib/music/progression'
import { voiceProgression } from '@/lib/music/satb'

import { CHORD_MEMBERS } from '@/lib/music/chord'
import type { RuleId } from '@/lib/music/voiceLeading'

import {
  cadenceConstraints,
  establishingCadence,
  type CadenceQuestion,
  type CadenceRoundSpec,
  type HarmonyQuestion,
  type HarmonyRoundSpec,
} from './generate'

/**
 * A progression on the way into the log, and on the way back out.
 *
 * The row keeps the key, the figured bass and the analysis — **exactly enough
 * to ask the question again and no more.** The four voices are not stored:
 * `voiceProgression` is a pure function of the progression, so keeping them
 * would be a second copy that could disagree with the figures beside it.
 */
export function harmonyAttempt(question: HarmonyQuestion): HarmonyAttempt {
  const stored = progressionKey(question.progression)
  const { key } = question.progression

  // A progression that cannot be figured cannot have been generated, so this
  // is unreachable in practice; an empty row matches no filter rather than
  // costing the player their attempt.
  return {
    kind: 'harmony',
    key: keyKey(key),
    bass: stored?.bass ?? '',
    figures: stored?.figures ?? '',
    beats: stored?.beats ?? '',
    analysis: stored?.analysis ?? '',
    tempo: question.tempo,
  }
}

/** The question a row was, rebuilt — the round trip the log's shape rests on. */
export function harmonyQuestion(
  attempt: HarmonyAttempt,
  establish: boolean,
): HarmonyQuestion | undefined {
  const key: Key | undefined = parseKeyKey(attempt.key)
  if (key === undefined) return undefined

  const progression = parseProgression(key, DEFAULT_METER, {
    bass: attempt.bass,
    figures: attempt.figures,
    beats: attempt.beats,
    analysis: attempt.analysis,
  })
  if (progression === undefined) return undefined

  const satz = voiceProgression(progression, { constraints: progression.constraints })
  if (satz === undefined) return undefined

  return {
    progression,
    satz,
    establish: establish ? establishingCadence(key) : undefined,
    tempo: attempt.tempo,
  }
}

/**
 * A level's own accuracy filter — its settings read as a query.
 *
 * Only what the level actually **bounds**: its keys, its cadences, how many
 * chords and how fast. Which Satzmodelle were allowed is deliberately absent,
 * for the same reason a rhythm level does not filter on its cell weights — a
 * block that was allowed and did not come up would have the level claiming
 * progressions it never asked.
 */
export function harmonyFilter(
  spec: HarmonyRoundSpec,
  exerciseId?: string,
): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'harmony',
    key: [...spec.keys],
    cadence: [...spec.cadences],
    chords: spec.chords.map(String),
    tempo: String(spec.tempo),
  }
}

/* ------------------------------------------------ writing one down, in four parts */

/**
 * A cadence-writing question on the way into the log.
 *
 * The progression is stored exactly as bass dictation's is — bass, figures,
 * beats, analysis — because it *is* a progression, and nothing about it being
 * written rather than heard changes what a progression is. The one field added
 * is the Lage, which is the only part of this question that cannot be derived
 * from the chords: which note the prompt wanted on top is the prompt's own.
 *
 * The player's setting is deliberately **not** stored. It is not the answer to
 * anything the row could ask again — a row keeps enough to pose the question,
 * and the question is the bass, the figures and the Lage.
 */
export function cadenceAttempt(question: CadenceQuestion): HarmonyAttempt {
  const stored = progressionKey(question.progression)
  const { key } = question.progression

  return {
    kind: 'harmony',
    key: keyKey(key),
    bass: stored?.bass ?? '',
    figures: stored?.figures ?? '',
    beats: stored?.beats ?? '',
    analysis: stored?.analysis ?? '',
    tempo: question.tempo,
    lage: question.lage,
  }
}

/** The question a row was, rebuilt — the round trip the log's shape rests on. */
export function cadenceQuestion(
  attempt: HarmonyAttempt,
  rules: readonly RuleId[],
): CadenceQuestion | undefined {
  const key: Key | undefined = parseKeyKey(attempt.key)
  const lage = attempt.lage
  if (key === undefined || lage === undefined) return undefined

  const progression = parseProgression(key, DEFAULT_METER, {
    bass: attempt.bass,
    figures: attempt.figures,
    beats: attempt.beats,
    analysis: attempt.analysis,
  })
  if (progression === undefined) return undefined

  // Voiced under the same constraints the generator used — reading a row back
  // without them rebuilds the same chords in different places, which is a row
  // disagreeing with the notation it produced.
  const constraints = cadenceConstraints(progression, lage)
  if (constraints === undefined) return undefined

  const model = voiceProgression(progression, { constraints })
  if (model === undefined) return undefined

  return { progression, lage, model, rules, tempo: attempt.tempo }
}

/**
 * A cadence level's own accuracy filter.
 *
 * Its keys, its cadences, how many chords, and the Lagen it asks for — the
 * dimensions the level actually **bounds**. Which rules were switched on is
 * deliberately absent, for the same reason a rhythm level does not filter on
 * its cell weights: the rules shape what counts as right rather than what comes
 * up, and a row does not record them.
 */
export function cadenceFilter(
  spec: CadenceRoundSpec,
  exerciseId?: string,
): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'harmony',
    key: [...spec.keys],
    cadence: [...spec.cadences],
    chords: spec.chords.map(String),
    // `top` rather than a facet of its own: which member stands on top is the
    // dimension chord questions already have, and sharing it is what lets one
    // query reach both.
    top: spec.lagen.map((lage) => String(CHORD_MEMBERS.indexOf(lage))),
  }
}
