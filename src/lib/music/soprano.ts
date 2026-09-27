import { degreePitch, isDegreeAlteration, stepAt, type Degree } from './degree'
import { degreeOf, type Key } from './key'
import { chromaticValue, diatonicValue, type Pitch } from './pitch'
import { SATB_RANGES, type Satz } from './satbVoicing'

/**
 * The soprano of a four-part setting, read as scale degrees **with their
 * octave**.
 *
 * In `lib/music` rather than beside the exercise because the attempt log needs
 * it too: a row stores the progression, and the soprano the player was asked
 * for is derived from it on the way back out rather than written down twice.
 */

/**
 * The tonic a soprano line is counted from: the one in the fourth octave.
 *
 * Unlike the bass, the soprano is answered with its octave, so this is not only
 * where the ink goes — `1` is this note, `↓7` the leading note under it and
 * `↑1` the octave above. The fourth octave is where the soprano's compass (C4
 * to G5) begins, so every tonic lands inside it.
 */
export function sopranoTonic(key: Key): Pitch {
  return { ...key.tonic, octave: 4 }
}

/** How far either side of the tonic a step search looks, in scale steps. */
const REACH = 7

/**
 * Every step of the key the soprano can sing, low to high — one key each.
 *
 * **The compass, not the question**: a keyboard reaching exactly as far as the
 * melody would give its highest and lowest notes away. So it is every step
 * whose plain note lies within `SATB_RANGES.soprano`, which in any key is
 * eleven or twelve of them.
 */
export function sopranoSteps(key: Key): readonly Degree[] {
  const tonic = sopranoTonic(key)
  const { lowest, highest } = SATB_RANGES.soprano
  const steps: Degree[] = []

  for (let rung = -REACH; rung <= 2 * REACH; rung += 1) {
    const step = stepAt(rung)
    const note = degreePitch(tonic, key.mode, step)
    if (note === undefined) continue
    if (
      chromaticValue(note) >= chromaticValue(lowest) &&
      chromaticValue(note) <= chromaticValue(highest)
    ) {
      steps.push(step)
    }
  }

  return steps
}

/**
 * The soprano line as scale degrees, with its octave — one per sonority.
 *
 * Every chord restrikes the soprano, a suspension's resolution included, so the
 * line has as many notes as the setting has events. The octave is counted from
 * `sopranoTonic` by staff position, so a B♯3 in C♯ major is the seventh *below*
 * the tonic whatever it sounds like.
 */
export function sopranoDegrees(key: Key, satz: Satz): readonly Degree[] | undefined {
  const tonic = sopranoTonic(key)
  const degrees: Degree[] = []

  for (const voicing of satz.voicings) {
    const note = voicing.soprano
    const found = degreeOf(key, note)
    if (found === undefined || !isDegreeAlteration(found.alteration)) return undefined

    const octave = Math.floor((diatonicValue(note) - diatonicValue(tonic)) / 7)
    degrees.push(
      octave === 0
        ? { number: found.number, alteration: found.alteration }
        : { number: found.number, alteration: found.alteration, octave },
    )
  }

  return degrees
}
