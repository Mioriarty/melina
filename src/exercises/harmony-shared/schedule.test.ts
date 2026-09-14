import { describe, expect, it } from 'vitest'

import { createRandom } from '@/lib/utils/seededRandom'
import { KEY_CHOICES, type Key } from '@/lib/music/key'
import { VOICES } from '@/lib/music/satbVoicing'
import { BLOCKS } from '@/lib/music/satzmodell'

import { buildQuestion, harmonySpec, type HarmonyQuestion } from './generate'
import { harmonySchedule, satzSchedule, satzSeconds } from './schedule'
import { DEFAULT_SETTINGS } from './settings'

/**
 * When the four voices sound.
 *
 * Pure arithmetic over the question and tested without a network or an
 * AudioContext, which is the whole reason it lives outside `engine.ts` — the
 * same split `rhythmSchedule.ts` makes.
 */

const C_MAJOR = KEY_CHOICES.find(
  (key) => key.tonic.letter === 'C' && key.mode === 'ionian',
) as Key

const SPEC = harmonySpec({
  ...DEFAULT_SETTINGS,
  keys: ['C:ionian'],
  chords: [6],
  cadences: ['kadenz-quartsext'],
  blocks: ['tonika-prolongation'],
  establish: true,
})

function question(seed = 5): HarmonyQuestion {
  const found = buildQuestion(createRandom(seed), SPEC, C_MAJOR)
  expect(found).toBeDefined()
  return found as HarmonyQuestion
}

describe('satzSchedule', () => {
  it('sounds every voice of every chord', () => {
    const asked = question()
    const notes = satzSchedule(asked.satz, asked.tempo)

    // Four voices a chord, less one for each bass that is held rather than
    // struck again.
    const held = asked.satz.events.filter((event) => event.held === true).length
    expect(notes).toHaveLength(asked.satz.events.length * VOICES.length - held)
  })

  it('lays the chords out in order and never backwards', () => {
    const asked = question()
    const notes = satzSchedule(asked.satz, asked.tempo)
    const times = notes.map((note) => note.at)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('strikes a held bass once, ringing under both sonorities', () => {
    // **This is what a suspension is.** Restriking the bass would say it had
    // moved, and not moving is the one thing a suspension is defined by.
    const asked = question()
    const suspension = asked.satz.events.findIndex((event) => event.held === true)
    expect(suspension, 'this question carries no suspension').toBeGreaterThan(0)

    const notes = satzSchedule(asked.satz, asked.tempo)
    const basses = notes.filter((note) =>
      asked.satz.voicings.some((voicing) => voicing.bass === note.pitch),
    )

    // One bass note fewer than there are chords.
    const struck = asked.satz.events.filter((event) => event.held !== true).length
    expect(basses.length).toBeGreaterThanOrEqual(struck)

    // The bass under the suspension rings at least as long as both halves.
    const both =
      (asked.satz.events[suspension - 1]?.ticks ?? 0) +
      (asked.satz.events[suspension]?.ticks ?? 0)
    const perTick =
      satzSeconds(asked.satz, asked.tempo) /
      asked.satz.events.reduce((total, event) => total + event.ticks, 0)
    const under = notes.find(
      (note) =>
        note.pitch === asked.satz.voicings[suspension - 1]?.bass &&
        note.duration >= both * perTick - 0.001,
    )
    expect(under, 'the bass did not ring under the suspension').toBeDefined()
  })

  it('goes faster when the tempo does', () => {
    const asked = question()
    expect(satzSeconds(asked.satz, 88)).toBeLessThan(satzSeconds(asked.satz, 56))
  })
})

describe('harmonySchedule', () => {
  it('plays the establishing cadence first, then a silence, then the question', () => {
    // Münster's own paper prefixes its harmony question with a Grundkadenz,
    // and for the same reason: writing a bass as *scale degrees* without one
    // asks the player to find the tonic first, which is a different question.
    const asked = question()
    expect(asked.establish).toBeDefined()

    const whole = harmonySchedule(asked)
    const cadence = satzSchedule(
      asked.establish as NonNullable<typeof asked.establish>,
      asked.tempo,
    )

    const opensAt = Math.min(...whole.slice(cadence.length).map((note) => note.at))
    const cadenceEnds = Math.max(...cadence.map((note) => note.at))
    expect(opensAt).toBeGreaterThan(cadenceEnds)
  })

  it('leaves the cadence out when the level says so', () => {
    const bare = buildQuestion(
      createRandom(5),
      harmonySpec({ ...DEFAULT_SETTINGS, keys: ['C:ionian'], establish: false }),
      C_MAJOR,
    )
    expect(bare?.establish).toBeUndefined()
    expect(harmonySchedule(bare as HarmonyQuestion)[0]?.at).toBe(0)
  })
})

describe('the establishing cadence itself', () => {
  it('is a real four-part setting, not a shortcut', () => {
    const asked = question()
    const cadence = asked.establish
    expect(cadence).toBeDefined()
    if (cadence === undefined) return

    expect(cadence.events).toHaveLength(4)
    for (const voicing of cadence.voicings) {
      for (const voice of VOICES) expect(voicing[voice]).toBeDefined()
    }
  })

  it('only names blocks the model actually has', () => {
    // A guard on the level data as much as on this file: a settings blob
    // naming a technique that has since been renamed would generate nothing.
    for (const id of [...SPEC.cadences, ...SPEC.blocks]) {
      expect(
        BLOCKS.some((block) => block.id === id),
        id,
      ).toBe(true)
    }
  })
})
