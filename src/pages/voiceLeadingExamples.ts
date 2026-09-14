import type { ChordSpec } from '@/lib/music/harmony'
import { buildEvents } from '@/lib/music/harmony'
import type { Key } from '@/lib/music/key'
import { parsePitch } from '@/lib/music/pitch'
import type { Satz, Voicing } from '@/lib/music/satbVoicing'
import type { RuleId } from '@/lib/music/voiceLeading'

/**
 * The settings the voice-leading guide draws.
 *
 * **Data rather than markup, and held to the grader by test.** A page that
 * teaches "this is a parallel fifth" and illustrates it with a setting that
 * also crosses two voices is worse than no page, because the reader learns the
 * wrong thing from the picture and nothing about the types would say so. So
 * `VoiceLeadingPage.test.ts` runs every example below through `satzFindings`
 * and insists each one produces **exactly** the fault it claims and no other.
 *
 * That single test proves two things at once: that the detector catches what it
 * says it catches, and that the page explaining it is honest. Two tests would
 * be two things that could drift apart.
 *
 * **The chords are built by the model and only the voicings are authored.**
 * `buildEvents` spells the sonorities from a key and a scale step exactly as
 * the generator does, so an example can never show a chord the exercise would
 * refuse to ask about; what is hand-written is only where the four voices go,
 * which is the thing being illustrated.
 *
 * Every example is **two chords in C major**, because a fault is a relation and
 * two chords is the fewest that can hold one — and because the reader is meant
 * to compare the clean setting at the top with each faulty one, which is only
 * possible if the harmony stays the same underneath.
 */

export interface VoiceLeadingExample {
  id: string
  /** The fault it illustrates. The opening example has none — it is the good one. */
  rule?: RuleId
  chords: readonly ChordSpec[]
  /** The four voices of each chord, **bass upward**, as `C3`, `F#4`. */
  voices: readonly (readonly [string, string, string, string])[]
}

export const C_MAJOR: Key = { tonic: { letter: 'C', alteration: 0 }, mode: 'ionian' }

/** I to V, which is the pair almost every example below is a spoiling of. */
const I_V: readonly ChordSpec[] = [
  { degree: 1, inversion: 0, beats: 2 },
  { degree: 5, inversion: 0, beats: 2 },
]

/** I to V7, for the rules a seventh brings with it. */
const I_V7: readonly ChordSpec[] = [
  { degree: 1, inversion: 0, beats: 2 },
  { degree: 5, inversion: 0, seventh: true, beats: 2 },
]

export const CLEAN_EXAMPLE: VoiceLeadingExample = {
  id: 'clean',
  chords: I_V,
  // Nothing wrong with it: every voice inside its compass, the common tone
  // held in the tenor, no two voices moving in parallel fifths or octaves.
  // **Every faulty example below is this setting with one voice moved**, which
  // is what makes them readable side by side — the fault is the only thing
  // that changed.
  voices: [
    ['C3', 'G3', 'C4', 'E4'],
    ['G2', 'G3', 'B3', 'D4'],
  ],
}

export const FAULT_EXAMPLES: readonly VoiceLeadingExample[] = [
  {
    // Bass and tenor stand a fifth apart and are still a fifth apart after
    // both have fallen a fourth.
    id: 'parallel-fifths',
    rule: 'parallel-fifths',
    chords: I_V,
    voices: [
      ['C3', 'G3', 'C4', 'E4'],
      ['G2', 'D3', 'B3', 'D4'],
    ],
  },
  {
    // Tenor and soprano an octave apart, and both rise a minor third: the two
    // voices stop being two.
    id: 'parallel-octaves',
    rule: 'parallel-octaves',
    chords: I_V,
    voices: [
      ['C3', 'E3', 'C4', 'E4'],
      ['G2', 'G3', 'B3', 'G4'],
    ],
  },
  {
    // The alto sings above the soprano.
    id: 'crossing',
    rule: 'crossing',
    chords: I_V,
    voices: [
      ['C3', 'G3', 'G4', 'E4'],
      ['G2', 'G3', 'B3', 'G4'],
    ],
  },
  {
    // More than an octave between soprano and alto, which leaves a hole in the
    // middle of the chord.
    id: 'spacing',
    rule: 'spacing',
    chords: I_V,
    voices: [
      ['C3', 'G3', 'C4', 'E4'],
      ['G2', 'G3', 'B3', 'D5'],
    ],
  },
  {
    // B is the leading note of C major, and tenor and alto are both on it.
    id: 'doubled-leading-note',
    rule: 'doubled-leading-note',
    chords: I_V,
    voices: [
      ['C3', 'G3', 'C4', 'E4'],
      ['G2', 'B3', 'B3', 'D4'],
    ],
  },
  {
    // The seventh of V7 is F, and the tenor takes it back up to G instead of
    // letting it fall to E.
    id: 'unresolved-seventh',
    rule: 'unresolved-seventh',
    chords: [...I_V7, { degree: 1, inversion: 0, beats: 4 }],
    voices: [
      ['C3', 'G3', 'C4', 'E4'],
      ['G2', 'F3', 'B3', 'D4'],
      ['C3', 'G3', 'C4', 'E4'],
    ],
  },
]

export const EXAMPLES: readonly VoiceLeadingExample[] = [CLEAN_EXAMPLE, ...FAULT_EXAMPLES]

/**
 * An example as a finished setting.
 *
 * `undefined` where the key cannot spell the chords, which no shipped example
 * reaches — the test proves it, so the page never has to render a hole.
 */
export function exampleSatz(example: VoiceLeadingExample): Satz | undefined {
  const events = example.chords.flatMap((spec) => buildEvents(C_MAJOR, spec) ?? [])
  if (events.length !== example.chords.length) return undefined

  const voicings: Voicing[] = []
  for (const [bass, tenor, alto, soprano] of example.voices) {
    const four = [bass, tenor, alto, soprano].map(parsePitch)
    if (four.some((note) => note === undefined)) return undefined
    const [b, t, a, s] = four as [
      NonNullable<ReturnType<typeof parsePitch>>,
      NonNullable<ReturnType<typeof parsePitch>>,
      NonNullable<ReturnType<typeof parsePitch>>,
      NonNullable<ReturnType<typeof parsePitch>>,
    ]
    voicings.push({ bass: b, tenor: t, alto: a, soprano: s })
  }

  if (voicings.length !== events.length) return undefined
  return { key: C_MAJOR, events, voicings }
}
