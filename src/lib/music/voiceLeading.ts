import { intervalBetween } from './interval'
import { chromaticValue } from './pitch'
import { tonicKey } from './scale'
import {
  LOWER_SPACING,
  motionBetween,
  PERFECT_FIFTH,
  PERFECT_OCTAVE,
  reduced,
  samePitchClass,
  SATB_RANGES,
  step,
  UPPER_SPACING,
  VOICES,
  WIDE_LEAP,
  contextOf,
  type EventContext,
  type Motion,
  type Move,
  type Satz,
  type VoiceId,
  type Voicing,
} from './satbVoicing'

/**
 * The rules a four-part setting is held to.
 *
 * **This module is written once and read three times.** Run as a filter it is
 * what `satb.ts` generates through — an edge that breaks a rule is an edge
 * that does not exist, and a preference is a weight. Run as a detector over a
 * finished `Satz` it is a *grader*, returning a list of findings rather than a
 * verdict. And run as a *list*, it is the vocabulary the writing exercises and
 * their guide are built out of: a level names the rules it holds the player to,
 * and the guide explains them one at a time.
 *
 * Building it that way round is the whole reason the generator can be trusted:
 * `satb.test.ts` voices every level's progressions and insists the grader finds
 * **nothing**. A generator checked against its own grader is the same move
 * `modeOf` makes on the scale generator and `readChord` on the chord one.
 *
 * **Every rule is a row, and that is what changed when the exercises arrived.**
 * They used to be paragraphs inside two long functions, which is fine for a
 * filter and useless for everything else: a rule written that way cannot be
 * named, cannot be explained, and cannot be switched off. Each one is now an
 * entry in `VOICE_LEADING_RULES` carrying its id, what kind of fault it is and
 * how bad it is, plus a `check` that returns only the voices at fault — the
 * framework builds the `Finding`. Adding a rule is a row; so is teaching the
 * guide about it, since the page walks this same list.
 *
 * The list itself is not invented here. It is the standard Stimmführung
 * inventory — spacing, crossing, overlap, doubling, omission, the four kinds of
 * motion, leading-note and seventh resolution, dissonance preparation.
 */

export type RuleId =
  | 'range'
  | 'spacing'
  | 'crossing'
  | 'overlap'
  | 'parallel-fifths'
  | 'parallel-octaves'
  | 'hidden-fifths'
  | 'hidden-octaves'
  | 'doubled-leading-note'
  | 'doubled-altered'
  | 'incomplete-chord'
  | 'wrong-note'
  | 'unresolved-leading-note'
  | 'unresolved-seventh'
  | 'unresolved-suspension'
  | 'augmented-second'
  | 'cross-relation'
  | 'large-leap'
  | 'static'

/**
 * Whether a rule says the **chord** is wrong or the **writing** is.
 *
 * The line matters because only one side of it is ever a choice. A setting
 * whose alto sings a note the chord does not contain has not answered the
 * question at all, so `harmony` rules are always on and are not offered to a
 * level; `leading` rules are the Satzfehler proper, and which of them a player
 * is held to is exactly what a level is for.
 */
export type RuleKind = 'harmony' | 'leading'

export type Severity = 'error' | 'warning'

export interface Finding {
  id: RuleId
  severity: Severity
  /** The event the fault is at; for a transition, the later of the two. */
  at: number
  voices: readonly VoiceId[]
}

/** Every voice group one rule faults. Empty is a clean pass. */
type Faults = readonly (readonly VoiceId[])[]

const NONE: Faults = []

interface RuleBase {
  id: RuleId
  kind: RuleKind
  severity: Severity
}

export interface ChordRule extends RuleBase {
  scope: 'chord'
  check: (subject: ChordCase) => Faults
}

export interface MoveRule extends RuleBase {
  scope: 'move'
  check: (subject: MoveCase) => Faults
}

export type VoiceLeadingRule = ChordRule | MoveRule

/* ------------------------------------------------------------ the subjects */

/**
 * One chord, with the doubling worked out.
 *
 * Two rules need to know which voices share a note, and counting it inside
 * each of them would count it twice for every candidate voicing the search
 * looks at. So the framework counts once and the rules read it.
 */
export interface ChordCase {
  context: EventContext
  voicing: Voicing
  /** Voices by pitch class, so a group of two or more is a doubling. */
  doubled: ReadonlyMap<string, readonly VoiceId[]>
}

/** How one pair of voices got from one chord to the next. */
export interface PairMotion {
  upper: VoiceId
  lower: VoiceId
  motion: Motion
  /** The interval between them before and after, reduced within the octave. */
  was: number
  now: number
}

/**
 * One transition, with every pair of voices measured.
 *
 * The four parallel rules all read the same six pairs, and the search asks
 * about tens of thousands of transitions per progression — so the pairs are
 * measured once here rather than four times over. Splitting one loop into four
 * rules is what makes them nameable; sharing this is what keeps it free.
 */
export interface MoveCase {
  move: Move
  pairs: readonly PairMotion[]
}

/** Neighbouring voices, top down: soprano–alto, alto–tenor, tenor–bass. */
const NEIGHBOURS: readonly (readonly [VoiceId, VoiceId])[] = VOICES.slice(0, -1).map(
  (voice, index) => [voice, VOICES[index + 1] as VoiceId] as const,
)

function pairsOf(move: Move): readonly PairMotion[] {
  const { before, after } = move
  const pairs: PairMotion[] = []

  for (let i = 0; i < VOICES.length; i += 1) {
    for (let j = i + 1; j < VOICES.length; j += 1) {
      const upper = VOICES[i] as VoiceId
      const lower = VOICES[j] as VoiceId
      pairs.push({
        upper,
        lower,
        motion: motionBetween(
          [before[upper], before[lower]],
          [after[upper], after[lower]],
        ),
        was: reduced(before[lower], before[upper]),
        now: reduced(after[lower], after[upper]),
      })
    }
  }

  return pairs
}

function doublingOf(voicing: Voicing): ReadonlyMap<string, readonly VoiceId[]> {
  const counts = new Map<string, VoiceId[]>()
  for (const voice of VOICES) {
    const key = tonicKey(voicing[voice])
    counts.set(key, [...(counts.get(key) ?? []), voice])
  }
  return counts
}

/* ------------------------------------------------------- one chord standing */

/**
 * Which of a pair may move into a perfect consonance by similar motion.
 *
 * **Only the outer voices**, because it is only there that the ear hears it —
 * a hidden fifth between alto and tenor is buried under two other parts and
 * nobody has ever marked one.
 */
const outerPair = (pair: PairMotion) => pair.upper === 'soprano' && pair.lower === 'bass'

/** A perfect consonance reached by similar motion, with the top voice leaping. */
function hiddenInto(subject: MoveCase, interval: number): Faults {
  const { before, after } = subject.move
  const found = subject.pairs.filter(
    (pair) =>
      outerPair(pair) &&
      (pair.motion === 'parallel' || pair.motion === 'similar') &&
      pair.was !== pair.now &&
      pair.now === interval &&
      Math.abs(step(before.soprano, after.soprano)) > 2,
  )
  return found.map((pair) => [pair.upper, pair.lower])
}

/** The same perfect consonance twice running, in the same pair of voices. */
function parallelAt(subject: MoveCase, interval: number): Faults {
  const found = subject.pairs.filter(
    (pair) =>
      (pair.motion === 'parallel' || pair.motion === 'similar') &&
      (pair.motion === 'parallel' || pair.was === pair.now) &&
      pair.was === interval &&
      pair.now === interval,
  )
  return found.map((pair) => [pair.upper, pair.lower])
}

/**
 * Every rule, in the order a reader meets them.
 *
 * The order is the one the guide prints and the one a report is sorted into:
 * what a voice can sing, then how the four stand together, then how they move,
 * then what a dissonance owes. It is not a ranking — `severity` is.
 */
export const VOICE_LEADING_RULES: readonly VoiceLeadingRule[] = [
  {
    // **Range.** What a voice can actually sing, which is `SATB_RANGES` and
    // not the staff.
    id: 'range',
    kind: 'leading',
    severity: 'error',
    scope: 'chord',
    check: ({ voicing }) =>
      VOICES.filter((voice) => {
        const note = chromaticValue(voicing[voice])
        return (
          note < chromaticValue(SATB_RANGES[voice].lowest) ||
          note > chromaticValue(SATB_RANGES[voice].highest)
        )
      }).map((voice) => [voice]),
  },
  {
    // **Crossing.** A voice below the one under it — the two lines swap, and
    // a listener hears neither of them any more.
    id: 'crossing',
    kind: 'leading',
    severity: 'error',
    scope: 'chord',
    check: ({ voicing }) =>
      NEIGHBOURS.filter(
        ([upper, lower]) =>
          chromaticValue(voicing[upper]) - chromaticValue(voicing[lower]) < 0,
      ),
  },
  {
    // **Spacing.** An octave at most between neighbouring upper voices; tenor
    // to bass may open further, which is the ordinary chorale texture.
    id: 'spacing',
    kind: 'leading',
    severity: 'error',
    scope: 'chord',
    check: ({ voicing }) =>
      NEIGHBOURS.filter(([upper, lower]) => {
        const gap = chromaticValue(voicing[upper]) - chromaticValue(voicing[lower])
        return gap > (lower === 'bass' ? LOWER_SPACING : UPPER_SPACING)
      }),
  },
  {
    // **The wrong note.** The bass is the event's own rather than a choice,
    // and every other voice has to sing a note the chord actually contains.
    // This is `harmony` rather than `leading`: a setting that fails it has not
    // written the chord badly, it has written a different chord.
    id: 'wrong-note',
    kind: 'harmony',
    severity: 'error',
    scope: 'chord',
    check: ({ context, voicing }) => {
      const found: (readonly VoiceId[])[] = []
      if (!samePitchClass(voicing.bass, context.event.bass)) found.push(['bass'])
      for (const voice of VOICES) {
        if (!context.notes.some((note) => samePitchClass(note, voicing[voice]))) {
          found.push([voice])
        }
      }
      return found
    },
  },
  {
    // **Omission.** A seventh chord may drop its fifth; a triad may too, with
    // the root then standing three times. Nothing else may go missing — the
    // third says whether the chord is major or minor, and the seventh is the
    // reason it is a seventh chord at all.
    id: 'incomplete-chord',
    kind: 'harmony',
    severity: 'error',
    scope: 'chord',
    check: ({ context, voicing }) => {
      const sounded = new Set(VOICES.map((voice) => tonicKey(voicing[voice])))
      const missing = context.notes.filter(
        (note) =>
          !sounded.has(tonicKey(note)) &&
          !(context.fifth !== undefined && samePitchClass(note, context.fifth)),
      )
      return missing.map(() => [])
    },
  },
  {
    // **Never double the leading note.** It wants to go somewhere particular,
    // and two voices going there together is what makes octaves.
    id: 'doubled-leading-note',
    kind: 'leading',
    severity: 'error',
    scope: 'chord',
    check: ({ context, doubled }) => {
      const leading = context.leadingNote
      if (leading === undefined) return NONE
      const voices = doubled.get(tonicKey(leading)) ?? []
      return voices.length > 1 ? [voices] : NONE
    },
  },
  {
    // **Never double a note from outside the key, or the seventh.** Both are
    // dissonances owing a resolution, and a doubled dissonance cannot pay it
    // in two voices at once without making octaves on the way.
    id: 'doubled-altered',
    kind: 'leading',
    severity: 'error',
    scope: 'chord',
    check: ({ context, doubled }) => {
      const found: (readonly VoiceId[])[] = []
      const leading =
        context.leadingNote === undefined ? undefined : tonicKey(context.leadingNote)

      for (const [note, voices] of doubled) {
        if (voices.length < 2 || note === leading) continue
        if (context.altered.some((altered) => tonicKey(altered) === note)) {
          found.push(voices)
        }
      }

      if (context.seventh !== undefined) {
        const voices = doubled.get(tonicKey(context.seventh)) ?? []
        if (voices.length > 1) found.push(voices)
      }

      return found
    },
  },
  {
    // **Parallel fifths** — the oldest prohibition there is, and the one an
    // exam marker finds first.
    id: 'parallel-fifths',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: (subject) => parallelAt(subject, PERFECT_FIFTH),
  },
  {
    // **Parallel octaves**, which are worse: the two voices stop being two.
    id: 'parallel-octaves',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: (subject) => parallelAt(subject, PERFECT_OCTAVE),
  },
  {
    id: 'hidden-fifths',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: (subject) => hiddenInto(subject, PERFECT_FIFTH),
  },
  {
    id: 'hidden-octaves',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: (subject) => hiddenInto(subject, PERFECT_OCTAVE),
  },
  {
    // **Overlap** — a voice moving past where its neighbour just *was*. Not a
    // crossing, since nothing is crossed in either chord taken alone; it is
    // heard across the two, which is why it is a rule about a move.
    id: 'overlap',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: ({ move: { before, after } }) =>
      NEIGHBOURS.flatMap(([upper, lower]) => {
        const found: (readonly VoiceId[])[] = []
        if (chromaticValue(after[lower]) > chromaticValue(before[upper])) {
          found.push([upper, lower])
        }
        if (chromaticValue(after[upper]) < chromaticValue(before[lower])) {
          found.push([upper, lower])
        }
        return found
      }),
  },
  {
    // **The augmented second** — the interval harmonic minor puts between its
    // sixth and seventh, and the one melodic minor exists to avoid. Unsingable
    // in this idiom, and a real trap in a minor key rather than a nicety.
    id: 'augmented-second',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: ({ move: { before, after } }) =>
      VOICES.filter((voice) => {
        const interval = intervalBetween(before[voice], after[voice])
        return interval?.number === 2 && interval.quality === 'augmented'
      }).map((voice) => [voice]),
  },
  {
    // A leap wider than a sixth is singable and rare. A warning, because the
    // line may well want it.
    id: 'large-leap',
    kind: 'leading',
    severity: 'warning',
    scope: 'move',
    check: ({ move: { before, after } }) =>
      VOICES.filter(
        (voice) => Math.abs(step(before[voice], after[voice])) > WIDE_LEAP,
      ).map((voice) => [voice]),
  },
  {
    // **Cross-relation** — the same letter, differently altered, in two voices
    // across the barline. A warning rather than an error: some are idiomatic.
    id: 'cross-relation',
    kind: 'leading',
    severity: 'warning',
    scope: 'move',
    check: ({ move: { before, after } }) => {
      const found: (readonly VoiceId[])[] = []
      for (const one of VOICES) {
        for (const other of VOICES) {
          if (one === other) continue
          const a = before[one]
          const b = after[other]
          if (a.letter === b.letter && a.alteration !== b.alteration) {
            found.push([one, other])
          }
        }
      }
      return found
    },
  },
  {
    // **The seventh resolves down by step.** The one rule every textbook opens
    // with, and the reason a seventh chord is not just a chord with a note
    // added. Holding it is allowed: it has not resolved yet.
    id: 'unresolved-seventh',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: ({ move: { from, before, after } }) => {
      if (from.seventh === undefined) return NONE
      const seventh = from.seventh

      return VOICES.filter((voice) => {
        if (!samePitchClass(before[voice], seventh)) return false
        if (samePitchClass(after[voice], seventh)) return false
        const moved = step(before[voice], after[voice])
        return moved > 0 || moved < -2
      }).map((voice) => [voice])
    },
  },
  {
    // **The leading note rises into the tonic**, checked only where it
    // actually has to: going to the chord the key is named after, in an outer
    // voice. Elsewhere a leading note may fall to the fifth so the chord can
    // be complete, which is the standard exception and not a fault — and a
    // leading note *inside a sequence* is a passing note that goes where the
    // sequence goes, so calling that a fault taxed every sequence the
    // generator could write.
    id: 'unresolved-leading-note',
    kind: 'leading',
    severity: 'warning',
    scope: 'move',
    check: ({ move: { from, to, before, after } }) => {
      if (from.leadingNote === undefined || !to.isTonic) return NONE
      const leading = from.leadingNote

      return VOICES.filter((voice) => {
        if (voice !== 'soprano' && voice !== 'bass') return false
        if (!samePitchClass(before[voice], leading)) return false
        const moved = step(before[voice], after[voice])
        return moved !== 1 && moved !== 0
      }).map((voice) => [voice])
    },
  },
  {
    // **A suspension resolves downward by step.** `held` says the bass did not
    // restrike, which is what makes this event the resolution of the one
    // before it: every upper voice whose note is gone has to have stepped down
    // into the note that replaced it.
    id: 'unresolved-suspension',
    kind: 'leading',
    severity: 'error',
    scope: 'move',
    check: ({ move: { to, before, after } }) => {
      if (to.event.held !== true) return NONE

      return VOICES.filter((voice) => {
        if (voice === 'bass') return false
        if (samePitchClass(before[voice], after[voice])) return false
        const moved = step(before[voice], after[voice])
        return moved !== -1 && moved !== -2
      }).map((voice) => [voice])
    },
  },
  {
    // Nothing moving at all is not a progression.
    id: 'static',
    kind: 'leading',
    severity: 'warning',
    scope: 'move',
    check: ({ move: { before, after } }) =>
      VOICES.every((voice) => samePitchClass(before[voice], after[voice]))
        ? [VOICES]
        : NONE,
  },
]

/* ------------------------------------------------------------ reading them */

export const RULE_IDS: readonly RuleId[] = VOICE_LEADING_RULES.map((rule) => rule.id)

/**
 * The rules a level may switch off.
 *
 * Everything a setting can get *wrong about the writing*. The `harmony` rules
 * are absent on purpose: a level cannot allow the alto to sing a note that is
 * not in the chord, because then there is no question left.
 */
export const SELECTABLE_RULE_IDS: readonly RuleId[] = VOICE_LEADING_RULES.filter(
  (rule) => rule.kind === 'leading',
).map((rule) => rule.id)

export function getRule(id: RuleId): VoiceLeadingRule | undefined {
  return VOICE_LEADING_RULES.find((rule) => rule.id === id)
}

export function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value)
}

/** Which rules are in force. `undefined` is all of them, which is the generator. */
export type RuleSet = ReadonlySet<RuleId> | undefined

function inForce(rule: VoiceLeadingRule, enabled: RuleSet): boolean {
  // A `harmony` rule is never a choice: a setting that breaks one has written
  // a different chord, and no level can be lenient about that.
  return rule.kind === 'harmony' || enabled === undefined || enabled.has(rule.id)
}

/* ------------------------------------------------------- vertical: one chord */

/** Everything that can be wrong with a single chord, without looking at its neighbours. */
export function chordFindings(
  context: EventContext,
  voicing: Voicing,
  at: number,
  enabled?: RuleSet,
): readonly Finding[] {
  const subject: ChordCase = { context, voicing, doubled: doublingOf(voicing) }
  const found: Finding[] = []

  for (const rule of VOICE_LEADING_RULES) {
    if (rule.scope !== 'chord' || !inForce(rule, enabled)) continue
    for (const voices of rule.check(subject)) {
      found.push({ id: rule.id, severity: rule.severity, at, voices })
    }
  }

  return found
}

/* ----------------------------------------------------- horizontal: a move */

/** Everything that can be wrong about getting from one chord to the next. */
export function moveFindings(
  move: Move,
  at: number,
  enabled?: RuleSet,
): readonly Finding[] {
  const subject: MoveCase = { move, pairs: pairsOf(move) }
  const found: Finding[] = []

  for (const rule of VOICE_LEADING_RULES) {
    if (rule.scope !== 'move' || !inForce(rule, enabled)) continue
    for (const voices of rule.check(subject)) {
      found.push({ id: rule.id, severity: rule.severity, at, voices })
    }
  }

  return found
}

/* ----------------------------------------------------------- the whole thing */

/** Every finding in a finished setting — the grader. */
export function satzFindings(satz: Satz, enabled?: RuleSet): readonly Finding[] {
  const contexts = satz.events.map((event) => contextOf(satz.key, event))
  const found: Finding[] = []

  for (const [index, context] of contexts.entries()) {
    const voicing = satz.voicings[index]
    if (voicing === undefined) continue
    found.push(...chordFindings(context, voicing, index, enabled))

    const next = contexts[index + 1]
    const after = satz.voicings[index + 1]
    if (next === undefined || after === undefined) continue
    found.push(
      ...moveFindings(
        { from: context, to: next, before: voicing, after },
        index + 1,
        enabled,
      ),
    )
  }

  return found
}

export function errorsOf(findings: readonly Finding[]): readonly Finding[] {
  return findings.filter((finding) => finding.severity === 'error')
}

export function chordAllowed(context: EventContext, voicing: Voicing): boolean {
  return chordFindings(context, voicing, 0).every(
    (finding) => finding.severity !== 'error',
  )
}

/** Whether a move breaks no rule at all — the filter the search runs on. */
export function moveAllowed(move: Move): boolean {
  return moveFindings(move, 0).every((finding) => finding.severity !== 'error')
}
