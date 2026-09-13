import type { AttemptFilter } from '@/lib/db/progress'
import type { HarmonyAttempt } from '@/lib/db/attemptQuestion'
import { keyKey, parseKeyKey, type Key } from '@/lib/music/key'
import { DEFAULT_METER } from '@/lib/music/progression'
import { parseProgression, progressionKey } from '@/lib/music/progression'
import { voiceProgression } from '@/lib/music/satb'

import {
  establishingCadence,
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
