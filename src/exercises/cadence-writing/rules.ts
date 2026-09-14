import { cadenceAttempt } from '@/exercises/harmony-shared/attempt'
import {
  generateCadenceRound,
  openingConstraint,
  type CadenceQuestion,
  type CadenceRoundSpec,
} from '@/exercises/harmony-shared/generate'
import type { RoundRules } from '@/exercises/shared/useRound'
import { pitchKey } from '@/lib/music/pitch'
import {
  samePitchClass,
  voicingPitches,
  type Satz,
  type Voicing,
} from '@/lib/music/satbVoicing'
import { errorsOf, satzFindings, type Finding } from '@/lib/music/voiceLeading'

/**
 * Marking a four-part setting.
 *
 * **There is no right answer to compare against**, and that is the thing this
 * exercise is built around rather than a limitation of it. A cadence can be set
 * a dozen ways, all of them correct; what can be said with certainty is which
 * rules a particular setting broke. So the verdict is a list of findings, and
 * the boolean the round machinery needs is derived from it rather than the
 * other way round.
 *
 * Three kinds of thing are checked and they are not the same kind:
 *
 * - **The chords**, always. A voice singing a note the chord does not contain
 *   has not written the cadence badly, it has written a different cadence — so
 *   the `harmony` rules are in force whatever a level has switched off. See
 *   `RuleKind`.
 * - **The Lage**, always, and it is deliberately *not* a rule in the registry.
 *   It is not a fact about four-part writing at all; it is what the prompt
 *   asked for, and a `Satz` has no way of carrying the question that produced
 *   it. Making it a rule would mean a grader that had to be told what was
 *   asked, which is the shape every other rule exists not to need.
 * - **The Satzfehler**, exactly those the level named.
 *
 * **Only an error fails.** A warning — a large leap, a Querstand — is reported
 * and costs nothing, because those are places a line may well want to go and a
 * marker weighs them rather than counting them. Switching such a rule off is
 * therefore about what the player is *told*, which is the honest reading of a
 * setting that does not change a verdict.
 */

/** The four voices of each chord, in the order the staff reads them. */
export type CadenceAnswer = readonly Voicing[]

export interface CadenceReport {
  /** Whether the setting opened in the Lage the prompt named. */
  lage: boolean
  /** Every rule the level has in force that the setting broke. */
  findings: readonly Finding[]
}

export function satzOf(question: CadenceQuestion, answer: CadenceAnswer): Satz {
  return {
    key: question.progression.key,
    events: question.progression.events,
    voicings: answer,
  }
}

export function cadenceReport(
  question: CadenceQuestion,
  answer: CadenceAnswer,
): CadenceReport {
  const wanted = openingConstraint(question.progression, question.lage)
  const opening = answer[0]?.soprano

  return {
    lage:
      wanted !== undefined &&
      opening !== undefined &&
      samePitchClass(opening, wanted.soprano),
    findings: satzFindings(satzOf(question, answer), new Set(question.rules)),
  }
}

export function isCadenceCorrect(
  chosen: CadenceAnswer,
  question: CadenceQuestion,
): boolean {
  const report = cadenceReport(question, chosen)
  return report.lage && errorsOf(report.findings).length === 0
}

/** What was written, bass upward per chord — the same order the staff reads. */
export function cadenceAnswerKey(answer: CadenceAnswer): string {
  return answer
    .map((voicing) => voicingPitches(voicing).map(pitchKey).join('.'))
    .join(',')
}

export const CADENCE_RULES: RoundRules<CadenceRoundSpec, CadenceQuestion, CadenceAnswer> =
  {
    generate: generateCadenceRound,
    isCorrect: isCadenceCorrect,
    attempt: cadenceAttempt,
    answerKey: cadenceAnswerKey,
  }
