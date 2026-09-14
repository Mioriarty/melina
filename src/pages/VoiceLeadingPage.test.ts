import { describe, expect, it } from 'vitest'

import {
  RULE_IDS,
  errorsOf,
  getRule,
  satzFindings,
  type Finding,
} from '@/lib/music/voiceLeading'

import {
  CLEAN_EXAMPLE,
  EXAMPLES,
  FAULT_EXAMPLES,
  exampleSatz,
} from './voiceLeadingExamples'

/**
 * **The guide held to the grader.**
 *
 * The one test that matters on this page, and it proves two things at once:
 * that each rule catches what the page says it catches, and that the picture
 * beside the words is actually a picture of it. A page teaching "this is a
 * parallel fifth" over a setting that also crosses two voices teaches the wrong
 * thing, and nothing about the types would say so — it is the same discipline
 * `FiguredBassPage.test.ts` applies when it holds every printed figure to
 * `canonicalFigures`.
 */

const idsOf = (findings: readonly Finding[]) => findings.map((finding) => finding.id)

describe('the voice-leading examples', () => {
  it.each(EXAMPLES)('$id builds a setting at all', (example) => {
    const satz = exampleSatz(example)
    expect(satz).toBeDefined()
    expect(satz?.voicings).toHaveLength(example.chords.length)
  })

  it('opens with a setting that breaks nothing', () => {
    // The example every faulty one below is a departure from. If this one has
    // a fault in it, the reader is comparing against the wrong thing.
    const satz = exampleSatz(CLEAN_EXAMPLE)
    expect(satz).toBeDefined()
    expect(idsOf(satzFindings(satz as NonNullable<typeof satz>))).toEqual([])
  })

  it.each(FAULT_EXAMPLES)('$id shows exactly the fault it claims', (example) => {
    const satz = exampleSatz(example)
    expect(satz).toBeDefined()
    if (satz === undefined) return

    const found = errorsOf(satzFindings(satz))
    const rule = example.rule

    expect(
      found.length,
      `${example.id} found: ${idsOf(found).join(', ')}`,
    ).toBeGreaterThan(0)
    expect([...new Set(idsOf(found))], `${example.id} should show only ${rule}`).toEqual([
      rule,
    ])
  })

  it('names a real rule for every fault it draws', () => {
    for (const example of FAULT_EXAMPLES) {
      expect(RULE_IDS, example.id).toContain(example.rule)
      expect(getRule(example.rule as (typeof RULE_IDS)[number])).toBeDefined()
    }
  })

  it('draws no two examples of the same rule', () => {
    const rules = FAULT_EXAMPLES.map((example) => example.rule)
    expect(new Set(rules).size).toBe(rules.length)
  })
})
