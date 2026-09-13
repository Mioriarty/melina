import { describe, expect, it } from 'vitest'

import { createRandom } from '@/lib/utils/seededRandom'

import { eventNotes } from './harmony'
import { KEY_CHOICES, keyKey, type Key } from './key'
import {
  analysisKey,
  cadenceOf,
  constraintsOf,
  DEFAULT_METER,
  generateProgression,
  parseAnalysis,
  parseProgression,
  progressionKey,
  type Progression,
  type ProgressionSpec,
} from './progression'
import { tonicKey } from './scale'
import { BLOCKS, getBlock } from './satzmodell'

/**
 * The backwards walk, and what it promises.
 *
 * The destination is chosen first and everything is prepended in front of it,
 * which is what makes a progression *arrive* somewhere rather than stop. These
 * are the properties that rests on.
 */

const CADENCES = BLOCKS.filter((block) => block.kind === 'cadence').map(
  (block) => block.id,
)
const MIDDLE = BLOCKS.filter(
  (block) => block.kind !== 'cadence' && block.kind !== 'opening',
).map((block) => block.id)

const SPEC: ProgressionSpec = {
  keys: KEY_CHOICES,
  chords: [5, 6, 7, 8],
  cadences: CADENCES,
  blocks: MIDDLE,
  freeWeight: 1,
  meter: DEFAULT_METER,
}

function many(spec: ProgressionSpec, count: number, seed = 11): readonly Progression[] {
  const random = createRandom(seed)
  const found: Progression[] = []
  for (let index = 0; index < count; index += 1) {
    const progression = generateProgression(random, spec)
    expect(progression, `progression ${index}`).toBeDefined()
    if (progression !== undefined) found.push(progression)
  }
  return found
}

describe('generateProgression', () => {
  it('comes out exactly as long as the level asked for', () => {
    // A walk that ran out of moves is a failed progression, not a shorter one:
    // handing it back gave four chords where the level said six.
    for (const progression of many(SPEC, 80)) {
      expect(SPEC.chords).toContain(progression.events.length)
    }
  })

  it('always ends on a cadence, because the cadence is chosen first', () => {
    for (const progression of many(SPEC, 80)) {
      const closing = cadenceOf(progression)
      expect(getBlock(closing ?? 'frei')?.kind, closing).toBe('cadence')
    }
  })

  it('opens on the tonic', () => {
    for (const progression of many(SPEC, 60)) {
      const opening = progression.events[0]
      expect(opening).toBeDefined()
      // The first chord of a progression stands on the first degree — either
      // because the opening block put it there or because the walk arrived.
      const notes = eventNotes(opening as NonNullable<typeof opening>)
      expect(notes.length).toBeGreaterThan(0)
    }
  })

  it('covers every event with exactly one annotation, in order', () => {
    // An analysis with a gap in it would leave a chord nothing could name, and
    // one with an overlap would name a chord twice.
    for (const progression of many(SPEC, 60)) {
      let next = 0
      for (const span of progression.analysis) {
        expect(span.from).toBe(next)
        expect(span.to).toBeGreaterThanOrEqual(span.from)
        next = span.to + 1
      }
      expect(next).toBe(progression.events.length)
    }
  })

  it('produces nothing but free motion when a level allows no blocks', () => {
    const walk = { ...SPEC, blocks: [], freeWeight: 1 }
    for (const progression of many(walk, 40)) {
      for (const span of progression.analysis) {
        const kind = getBlock(span.id)?.kind
        expect(['cadence', 'opening', undefined], span.id).toContain(kind)
      }
    }
  })

  it('produces no free motion at all when a level forbids it', () => {
    const strict = { ...SPEC, freeWeight: 0 }
    for (const progression of many(strict, 40)) {
      expect(progression.analysis.map((span) => span.id)).not.toContain('frei')
    }
  })
})

describe('the stored form', () => {
  it('round-trips the notes, the lengths and the analysis', () => {
    for (const progression of many(SPEC, 60)) {
      const stored = progressionKey(progression)
      expect(stored, keyKey(progression.key)).toBeDefined()
      if (stored === undefined) continue

      const read = parseProgression(progression.key, DEFAULT_METER, stored)
      expect(read, stored.bass).toBeDefined()
      if (read === undefined) continue

      expect(read.events.map((event) => eventNotes(event).map(tonicKey))).toEqual(
        progression.events.map((event) => eventNotes(event).map(tonicKey)),
      )
      expect(read.analysis).toEqual(progression.analysis)
      expect(read.constraints).toEqual(progression.constraints)
    }
  })

  it('round-trips an analysis through its own key', () => {
    for (const progression of many(SPEC, 30)) {
      expect(parseAnalysis(analysisKey(progression.analysis))).toEqual(
        progression.analysis,
      )
    }
  })
})

describe('constraintsOf', () => {
  /**
   * **The regression that cost a whole round trip.**
   *
   * A free chord is annotated `frei`, and `frei` is not in `BLOCKS` — so
   * rebuilding the constraints by walking the spans and counting events as it
   * went skipped that chord and shifted every index after it. A cadence's
   * "tonic in the soprano" then landed on the chord before it, the voicing
   * search found no legal way to sing that, and reading the row back returned
   * nothing at all. Each span carries its own `from`, and using it is what
   * makes an unknown block cost only its own Lage.
   */
  it('places a constraint by its own span, not by counting the ones before it', () => {
    const key = KEY_CHOICES.find(
      (candidate) => candidate.tonic.letter === 'C' && candidate.mode === 'ionian',
    ) as Key

    const withGap = constraintsOf(key, [
      { id: 'frei', origin: 4, links: 1, from: 0, to: 0 },
      { id: 'ganzschluss-vollkommen', origin: 1, links: 1, from: 1, to: 2 },
    ])

    // The cadence names the tonic in the soprano of its *last* chord, which is
    // event 2 — not event 1, which is where counting the known blocks lands.
    expect(withGap).toHaveLength(1)
    expect(withGap[0]?.event).toBe(2)
    expect(tonicKey(withGap[0]?.soprano as never)).toBe('C')
  })

  it('survives a span naming a block this version no longer has', () => {
    const key = KEY_CHOICES[0] as Key
    expect(() =>
      constraintsOf(key, [
        { id: 'quintfall-in-thirds' as never, origin: 1, links: 2, from: 0, to: 3 },
      ]),
    ).not.toThrow()
  })
})
