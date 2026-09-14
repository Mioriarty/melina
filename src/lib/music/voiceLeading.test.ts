import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT } from './meter'
import type { HarmonicEvent } from './harmony'
import type { Key } from './key'
import { pitch, type Letter } from './pitch'
import type { Satz, Voicing } from './satbVoicing'
import {
  RULE_IDS,
  SELECTABLE_RULE_IDS,
  VOICE_LEADING_RULES,
  getRule,
  isRuleId,
  satzFindings,
  type RuleId,
} from './voiceLeading'

/**
 * The registry's own invariants, and the one thing selection has to get right.
 *
 * What each rule actually *catches* is not tested here but in
 * `VoiceLeadingPage.test.ts`, which runs the guide's own examples through the
 * grader and insists each one produces exactly the fault it claims to
 * illustrate — so the detector and the page that explains it are proved by one
 * test rather than by two that could drift apart.
 */

const C_MAJOR: Key = { tonic: { letter: 'C', alteration: 0 }, mode: 'ionian' }

const BEAT = TICKS_PER_BEAT * 2

const event = (bass: Letter, upper: readonly Letter[]): HarmonicEvent => ({
  bass: { letter: bass, alteration: 0 },
  upper: upper.map((letter) => ({ letter, alteration: 0 })),
  ticks: BEAT,
})

/** I to ii with the outer voices moving up a step together: parallel fifths. */
const PARALLELS: Satz = {
  key: C_MAJOR,
  events: [event('C', ['G', 'E']), event('D', ['A', 'F'])],
  voicings: [
    {
      bass: pitch('C', 0, 3),
      tenor: pitch('E', 0, 3),
      alto: pitch('C', 0, 4),
      soprano: pitch('G', 0, 4),
    },
    {
      bass: pitch('D', 0, 3),
      tenor: pitch('F', 0, 3),
      alto: pitch('D', 0, 4),
      soprano: pitch('A', 0, 4),
    },
  ],
}

/** The same two chords, with the alto singing a note neither of them contains. */
const WRONG_NOTE: Satz = {
  key: C_MAJOR,
  events: PARALLELS.events,
  voicings: [
    { ...(PARALLELS.voicings[0] as Voicing), alto: pitch('B', 0, 3) },
    PARALLELS.voicings[1] as Voicing,
  ],
}

const idsIn = (satz: Satz, enabled?: ReadonlySet<RuleId>) =>
  new Set(satzFindings(satz, enabled).map((finding) => finding.id))

describe('the rule registry', () => {
  it('holds every rule id exactly once', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length)
    expect(RULE_IDS.length).toBe(VOICE_LEADING_RULES.length)
  })

  it('answers for every id it names', () => {
    for (const id of RULE_IDS) {
      expect(getRule(id)?.id, id).toBe(id)
      expect(isRuleId(id)).toBe(true)
    }
    expect(isRuleId('not-a-rule')).toBe(false)
  })

  it('offers exactly the voice-leading rules to a level', () => {
    // A level chooses which Satzfehler it marks. It can never choose to allow
    // a chord that is simply the wrong chord, so the `harmony` rules are not
    // on the list — see `RuleKind`.
    for (const rule of VOICE_LEADING_RULES) {
      expect(SELECTABLE_RULE_IDS.includes(rule.id), rule.id).toBe(rule.kind === 'leading')
    }
    expect(SELECTABLE_RULE_IDS).toContain('parallel-fifths')
    expect(SELECTABLE_RULE_IDS).not.toContain('wrong-note')
    expect(SELECTABLE_RULE_IDS).not.toContain('incomplete-chord')
  })
})

describe('which rules are in force', () => {
  it('finds everything when nothing is named', () => {
    expect(idsIn(PARALLELS)).toContain('parallel-fifths')
  })

  it('says nothing about a rule that is switched off', () => {
    const without = new Set(SELECTABLE_RULE_IDS.filter((id) => id !== 'parallel-fifths'))
    expect(idsIn(PARALLELS, without)).not.toContain('parallel-fifths')
  })

  it('still finds the wrong chord however little is switched on', () => {
    // The whole point of the `harmony`/`leading` split: a level may be as
    // lenient as it likes about how a chord was written and never about
    // whether it is the chord that was asked for.
    expect(idsIn(WRONG_NOTE, new Set())).toContain('wrong-note')
  })

  it('is the whole selectable list that the generator is held to', () => {
    // `transitionCost` passes no set, so a level switching a rule off changes
    // what a *player* is marked on and never what the app itself writes.
    const everything = idsIn(PARALLELS)
    const named = idsIn(PARALLELS, new Set(SELECTABLE_RULE_IDS))
    expect([...named].sort()).toEqual([...everything].sort())
  })
})
