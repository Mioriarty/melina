import type { StruckNote } from '@/lib/audio/engine'
import { TICKS_PER_BEAT } from '@/lib/music/meter'
import { VOICES, type Satz } from '@/lib/music/voiceLeading'

import type { HarmonyQuestion } from './generate'

/**
 * When each of the four voices sounds.
 *
 * Pure arithmetic over the question, kept out of `engine.ts` for the reason
 * `rhythmSchedule.ts` and both `chordSchedule.ts` are: otherwise the
 * scheduling would be the one part of playback that nothing could test without
 * a network and an AudioContext.
 *
 * Two rules, and the second is what a suspension is:
 *
 * - **Every voice rings until the chord changes**, which is what makes four
 *   parts sound like a chord rather than four melodies.
 * - **A held bass is struck once** and rings under both sonorities. Restriking
 *   it would say the bass had moved, and a suspension is defined by its not
 *   having done so — the same rule `playStruck` already follows for a figured
 *   bass.
 */

/** How long the last chord goes on ringing after the progression ends. */
const TAIL = 1.4
/** Silence between the establishing cadence and the question itself. */
const GAP = 0.9

function secondsPerTick(tempo: number): number {
  return 60 / (tempo * TICKS_PER_BEAT)
}

/** One setting, laid out from `from` seconds. */
export function satzSchedule(satz: Satz, tempo: number, from = 0): readonly StruckNote[] {
  const perTick = secondsPerTick(tempo)
  const notes: StruckNote[] = []

  let at = from
  for (const [index, event] of satz.events.entries()) {
    const voicing = satz.voicings[index]
    if (voicing === undefined) continue

    const length = event.ticks * perTick
    const last = index === satz.events.length - 1

    for (const voice of VOICES) {
      // The bass of a resolution was struck with the suspension and is still
      // sounding; striking it again would be a new bass note.
      if (voice === 'bass' && event.held === true) continue

      // A held bass rings on through however many sonorities follow it.
      let ring = length
      if (voice === 'bass') {
        for (let after = index + 1; after < satz.events.length; after += 1) {
          if (satz.events[after]?.held !== true) break
          ring += (satz.events[after]?.ticks ?? 0) * perTick
        }
      }

      notes.push({ pitch: voicing[voice], at, duration: ring + (last ? TAIL : 0) })
    }

    at += length
  }

  return notes
}

export function satzSeconds(satz: Satz, tempo: number): number {
  const perTick = secondsPerTick(tempo)
  return satz.events.reduce((total, event) => total + event.ticks * perTick, 0)
}

/** The establishing cadence, a silence, then the question. */
export function harmonySchedule(question: HarmonyQuestion): readonly StruckNote[] {
  const { establish, satz, tempo } = question
  if (establish === undefined) return satzSchedule(satz, tempo)

  const lead = satzSeconds(establish, tempo) + GAP
  return [...satzSchedule(establish, tempo), ...satzSchedule(satz, tempo, lead)]
}
