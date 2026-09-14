import { chromaticValue, type Pitch } from '@/lib/music/pitch'
import type { ScoreCursor } from '@/lib/notation/scoreCursor'
import {
  SATB_RANGES,
  VOICES_UP,
  type VoiceId,
  type Voicing,
} from '@/lib/music/satbVoicing'
import type { PitchClass } from '@/lib/music/scale'

/**
 * The four-part setting being written.
 *
 * **A sequence, not a set**, which is the whole difference from `chord-entry`'s
 * draft. There a figure underdetermines the voicing and what is collected is
 * the notes placed, with `voiceChord` deciding where they sit; here *which
 * voice sings which note* is the answer, and where each one sits is most of
 * what is being graded — spacing, crossing and overlap are all facts about
 * octaves. So a slot is a voice of a chord, and it holds a `Pitch`.
 *
 * It fills **chord by chord, bottom up**, because that is how a chorale is
 * built: the bass is given, the tenor stands on it, the alto on the tenor and
 * the soprano on top. Which voices are given and which are written is the
 * question's business rather than this module's — cadence writing gives the
 * bass, and a chorale harmonisation will give the soprano and ask for the other
 * three in the same shape.
 *
 * There is **no confirm key**, which is earned the way rhythmic dictation earns
 * it rather than copied: a setting is exactly fillable — so many voices times so
 * many chords — so the press that fills the last voice of the last chord is the
 * press that answers.
 */

/** The voices a question puts on the staff itself. */
export type GivenVoices = Partial<Record<VoiceId, Pitch>>

export interface SatzDraft {
  /** What the question already draws, one entry per chord. */
  given: readonly GivenVoices[]
  /** The voices the player writes, in the order they are asked for. */
  order: readonly VoiceId[]
  /** What has been written, chord by chord, each in `order`. */
  written: readonly (readonly Pitch[])[]
}

export function emptySatzDraft(
  given: readonly GivenVoices[],
  order: readonly VoiceId[],
): SatzDraft {
  return { given, order, written: given.map(() => []) }
}

/** Which voice of which chord the next press goes into. */
export interface SatzSlot {
  chord: number
  voice: VoiceId
}

export function currentSlot(draft: SatzDraft): SatzSlot | undefined {
  const chord = draft.written.findIndex((notes) => notes.length < draft.order.length)
  if (chord === -1) return undefined

  const voice = draft.order[draft.written[chord]?.length ?? 0]
  return voice === undefined ? undefined : { chord, voice }
}

export function isFull(draft: SatzDraft): boolean {
  return currentSlot(draft) === undefined
}

/** The chord the cursor bands, in the engraver's own terms. */
export function cursorOf(draft: SatzDraft): ScoreCursor | undefined {
  const slot = currentSlot(draft)
  return slot === undefined ? undefined : { event: slot.chord, position: 0 }
}

export function place(draft: SatzDraft, note: Pitch): SatzDraft {
  const slot = currentSlot(draft)
  if (slot === undefined) return draft

  return {
    ...draft,
    written: draft.written.map((notes, at) =>
      at === slot.chord ? [...notes, note] : notes,
    ),
  }
}

export function canRemove(draft: SatzDraft): boolean {
  return draft.written.some((notes) => notes.length > 0)
}

export function removeLast(draft: SatzDraft): SatzDraft {
  if (!canRemove(draft)) return draft
  const chord = draft.written.reduce(
    (found, notes, at) => (notes.length > 0 ? at : found),
    -1,
  )
  return {
    ...draft,
    written: draft.written.map((notes, at) =>
      at === chord ? notes.slice(0, -1) : notes,
    ),
  }
}

/* ---------------------------------------------------------- reading it back */

/** Every voice of one chord that is known — given or written. */
export function voicesAt(draft: SatzDraft, chord: number): GivenVoices {
  const found: GivenVoices = { ...draft.given[chord] }
  for (const [index, note] of (draft.written[chord] ?? []).entries()) {
    const voice = draft.order[index]
    if (voice !== undefined) found[voice] = note
  }
  return found
}

/**
 * The setting as four complete voices, or `undefined` while it is unfinished.
 *
 * The shape the grader takes, and the reason grading needs no special case for
 * a half-written answer: there is no half-written answer, because the last
 * press is the one that submits.
 */
export function satzVoicings(draft: SatzDraft): readonly Voicing[] | undefined {
  const voicings: Voicing[] = []

  for (let chord = 0; chord < draft.given.length; chord += 1) {
    const voices = voicesAt(draft, chord)
    const { soprano, alto, tenor, bass } = voices
    if (soprano === undefined || alto === undefined) return undefined
    if (tenor === undefined || bass === undefined) return undefined
    voicings.push({ soprano, alto, tenor, bass })
  }

  return voicings
}

/* ------------------------------------------------------------ where a note goes */

/**
 * Where a note would sit if it were pressed now — **octave and all**.
 *
 * The keyboard is seven letters, so the octave is the app's to choose, and the
 * choice is not free: a letter names two pitches inside a voice's compass and
 * never three, since no range here spans two octaves. What decides between them
 * is what a singer would do.
 *
 * - **After the first chord, the nearest note to where this voice just was.**
 *   That is the voice-leading default and the one that is right almost every
 *   time; a line that moves the least is the line a chorale writes.
 * - **In the first chord, the lowest note at or above the voice underneath.**
 *   Close position from the bass up, which is the ordinary chorale texture,
 *   the one `voiceChord` already uses everywhere else in the app, and — not
 *   incidentally — the one that keeps every key legible: a tenor default in the
 *   middle of its own compass sits at A3, two ledger lines above the bass
 *   staff, so every key drew a note hanging in the air over its own staff.
 *
 * `shift` is the one-shot octave switch, and it means *the other octave*. There
 * is only ever one, so the switch is unambiguous; where there is none, it does
 * nothing and the key goes on drawing the note it will actually write. That is
 * the rule the realising keyboard already lives by — what you see is what you
 * get — and it is why the switch can never mislead: you look at the key before
 * you press it.
 */
export function placedPitch(
  draft: SatzDraft,
  note: PitchClass,
  shift = false,
): Pitch | undefined {
  const slot = currentSlot(draft) ?? lastSlot(draft)
  if (slot === undefined) return undefined

  const options = placements(note, slot.voice)
  if (options.length === 0) return undefined

  const best = preferred(draft, slot, options)
  if (!shift) return best

  const other = options.find((option) => option.octave !== best.octave)
  return other ?? best
}

/**
 * Where the row points once everything is written.
 *
 * A key that loses its picture at the moment of answering resizes under the
 * hand that just pressed it, so the row goes on showing the last voice it was
 * asked about rather than emptying — the same choice `chord-entry`'s keyboard
 * makes for a chord that is already full.
 */
function lastSlot(draft: SatzDraft): SatzSlot | undefined {
  const chord = draft.given.length - 1
  const voice = draft.order[draft.order.length - 1]
  return chord < 0 || voice === undefined ? undefined : { chord, voice }
}

function placements(note: PitchClass, voice: VoiceId): readonly Pitch[] {
  const range = SATB_RANGES[voice]
  const found: Pitch[] = []

  for (
    let octave = range.lowest.octave;
    octave <= range.highest.octave + 1;
    octave += 1
  ) {
    const candidate: Pitch = { ...note, octave }
    if (
      chromaticValue(candidate) >= chromaticValue(range.lowest) &&
      chromaticValue(candidate) <= chromaticValue(range.highest)
    ) {
      found.push(candidate)
    }
  }

  return found
}

/**
 * Which of a letter's two pitches this voice should take.
 *
 * After the first chord it is wherever the voice already was. In the first
 * chord there is nothing to follow, so it stacks: the lowest note at or above
 * the voice underneath, which is close position and the texture a chorale opens
 * in more often than not. Where a voice has nothing below it — the bass, in a
 * question that gives none — the bottom of its own compass stands in.
 *
 * It is only ever a *default*: the octave switch reaches the other one, and
 * every key draws what it will actually write, so nothing about this can
 * surprise the player.
 */
function preferred(draft: SatzDraft, slot: SatzSlot, options: readonly Pitch[]): Pitch {
  const before = slot.chord > 0 ? voicesAt(draft, slot.chord - 1)[slot.voice] : undefined
  if (before !== undefined) return nearest(options, chromaticValue(before))

  const floor = under(draft, slot) ?? chromaticValue(SATB_RANGES[slot.voice].lowest)
  return stackedOn(options, floor)
}

function under(draft: SatzDraft, slot: SatzSlot): number | undefined {
  const voices = voicesAt(draft, slot.chord)
  const ladder = VOICES_UP.slice(0, VOICES_UP.indexOf(slot.voice)).reverse()
  for (const voice of ladder) {
    const note = voices[voice]
    if (note !== undefined) return chromaticValue(note)
  }
  return undefined
}

function nearest(options: readonly Pitch[], to: number): Pitch {
  return options.reduce((best, option) =>
    Math.abs(chromaticValue(option) - to) < Math.abs(chromaticValue(best) - to)
      ? option
      : best,
  )
}

/** The lowest option at or above `floor`, or the highest there is below it. */
function stackedOn(options: readonly Pitch[], floor: number): Pitch {
  const above = options.filter((option) => chromaticValue(option) >= floor)
  if (above.length > 0) {
    return above.reduce((best, option) =>
      chromaticValue(option) < chromaticValue(best) ? option : best,
    )
  }
  return options.reduce((best, option) =>
    chromaticValue(option) > chromaticValue(best) ? option : best,
  )
}
