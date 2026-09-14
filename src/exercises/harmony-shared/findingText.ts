import type { MusicNames } from '@/hooks/useMusicNames'
import type { VoiceId } from '@/lib/music/satbVoicing'
import { getRule, type Finding } from '@/lib/music/voiceLeading'

/**
 * One finding as a sentence.
 *
 * Beside the component rather than inside it, so it can be read against the
 * model in a test: what a report actually *says* is the whole of what this
 * exercise gives back when an answer is wrong, and a wrong chord number or a
 * voice named for the wrong fault is a lie the types cannot catch.
 *
 * **Four keys rather than one assembled from parts.** Which chords a fault is
 * at, and whether any voices are named, are the two things that vary — and a
 * sentence glued together from a "where" and a "who" is a sentence a translator
 * cannot fix. `incomplete-chord` is the one that names no voices: nothing is
 * wrong with any of them, something is simply missing.
 */

export type Translate = (key: string, values: Record<string, string | number>) => string

export function findingLine(finding: Finding, t: Translate, names: MusicNames): string {
  const rule = getRule(finding.id)
  const label = rule === undefined ? finding.id : names.rule(finding.id)
  const voices = voiceList(finding.voices, t, names)

  // A chord rule is at one chord; a move rule is between the chord before it
  // and this one. Chords are counted from one, as a reader counts them.
  if (rule?.scope === 'move') {
    const where = { from: finding.at, to: finding.at + 1, rule: label }
    return voices === ''
      ? t('satb.findings.move', where)
      : t('satb.findings.moveVoices', { ...where, voices })
  }

  const where = { chord: finding.at + 1, rule: label }
  return voices === ''
    ? t('satb.findings.chord', where)
    : t('satb.findings.chordVoices', { ...where, voices })
}

function voiceList(voices: readonly VoiceId[], t: Translate, names: MusicNames): string {
  const spoken = voices.map((voice) => names.voice(voice))
  if (spoken.length === 0) return ''
  if (spoken.length === 1) return spoken[0] as string
  if (spoken.length === 2) {
    return t('satb.findings.pair', { a: spoken[0] as string, b: spoken[1] as string })
  }
  // Three or more is a list rather than a sentence, and a comma is a list in
  // both languages.
  return spoken.join(', ')
}

/** Errors before warnings, then in the order they happen. */
export function orderFindings(findings: readonly Finding[]): readonly Finding[] {
  return [...findings].sort(
    (a, b) =>
      (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) || a.at - b.at,
  )
}
