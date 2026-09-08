import { getClef, type ClefId } from '@/lib/music/clef'
import {
  alterationInKey,
  meiKeySignature,
  type KeySignatureId,
} from '@/lib/music/keySignature'
import { diatonicValue, type Alteration, type Pitch } from '@/lib/music/pitch'

/**
 * Minimal MEI for a single engraved example.
 *
 * Verovio accepts several input formats; MEI is the one that lets us state
 * the clef, the key signature and each note's *written* accidental exactly,
 * with no guessing in between.
 */

export interface HarmonicIntervalOptions {
  lower: Pitch
  upper: Pitch
  clef: ClefId
  keySignature: KeySignatureId
  /** Engraved in place but not drawn, until the answer reveals it. */
  hide?: 'lower' | 'upper'
}

/** No sharps, no flats: every alteration a scale needs is printed. */
const KEYLESS: KeySignatureId = '0'

/**
 * MEI's *written* accidentals — the glyph that gets drawn.
 *
 * A double sharp is `x`, the 𝄪 glyph. It is not `ss`: MEI has both, and `ss`
 * means two separate sharp signs side by side, which is what Verovio then
 * draws. A double flat, by contrast, really is two flats — `ff` — because
 * that is how the notation itself is written.
 */
const WRITTEN_ACCIDENTALS: Record<Alteration, string> = {
  [-2]: 'ff',
  [-1]: 'f',
  0: 'n',
  1: 's',
  2: 'x',
}

/**
 * MEI's *gestural* accidentals — the sounding pitch, with nothing drawn.
 *
 * A separate list because it is a separate MEI data type, and it has no `x`
 * in it: a silent double sharp is `ss`. Nothing reaches this today, since a
 * key signature only ever implies a single sharp or flat, but the two lists
 * are not interchangeable and must not be written as one.
 */
const GESTURAL_ACCIDENTALS: Record<Alteration, string> = {
  [-2]: 'ff',
  [-1]: 'f',
  0: 'n',
  1: 's',
  2: 'ss',
}

/**
 * Decide how a note's accidental is encoded.
 *
 * `@accid` is a *written* accidental — Verovio draws it. `@accid.ges` is a
 * gestural one: it fixes the sounding pitch without printing anything, which
 * is what you want when the key signature has already said it.
 *
 * So: print an accidental only when the note disagrees with the signature.
 * In D major, F sharp prints nothing and F natural prints a natural. Encoding
 * this the other way round yields notation that looks perfectly clean and
 * means something else entirely.
 */
export function accidentalAttributes(value: Pitch, keySignature: KeySignatureId): string {
  const implied = alterationInKey(value.letter, keySignature)

  return value.alteration === implied
    ? ` accid.ges="${GESTURAL_ACCIDENTALS[value.alteration]}"`
    : ` accid="${WRITTEN_ACCIDENTALS[value.alteration]}"`
}

/**
 * A note that has not been revealed yet.
 *
 * `@visible="false"` engraves the note in full — its place in the bar, its
 * accidental, the width it takes — and then does not draw it. That is what
 * keeps a hearing question from jumping about when the answer arrives: the
 * staff is laid out once, for the whole interval or the whole scale, and
 * revealing it only makes the rest of it visible.
 *
 * Leaving the note out instead re-engraves a different piece of music, and
 * everything moves: the staff narrows, and the note that was on screen slides
 * across to a new position.
 */
const HIDDEN = ' visible="false"'

function noteElement(
  value: Pitch,
  keySignature: KeySignatureId,
  duration = '',
  hidden = false,
): string {
  const pname = value.letter.toLowerCase()
  const dur = duration === '' ? '' : ` ${duration}`
  const accidental = accidentalAttributes(value, keySignature)
  return `<note pname="${pname}" oct="${value.octave}"${dur}${accidental}${hidden ? HIDDEN : ''}/>`
}

/**
 * The document around a single measure of content.
 *
 * `@right="invis"` hides the closing barline so the example reads as a
 * fragment rather than as a one-bar piece.
 */
function document(clef: ClefId, keySignature: KeySignatureId, layer: string): string {
  const { sign, line } = getClef(clef)

  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
  <meiHead>
    <fileDesc>
      <titleStmt><title/></titleStmt>
      <pubStmt/>
    </fileDesc>
  </meiHead>
  <music>
    <body>
      <mdiv>
        <score>
          <scoreDef keysig="${meiKeySignature(keySignature)}">
            <staffGrp>
              <staffDef n="1" lines="5" clef.shape="${sign}" clef.line="${line}"/>
            </staffGrp>
          </scoreDef>
          <section>
            <measure n="1" right="invis">
              <staff n="1">
                <layer n="1">
                  ${layer}
                </layer>
              </staff>
            </measure>
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`
}

/**
 * Two notes sounding together.
 *
 * A chord — except at the unison, where both noteheads want the same spot on
 * the staff and there is nowhere to put the second one. Stacked, C to C sharp
 * and C sharp to C sharp engrave as *the same picture*: one sharp and two
 * touching noteheads, with nothing to say which note the sharp belongs to.
 * Written one after the other, each note carries its own accidental and the
 * two intervals read as what they are.
 *
 * This is the one case where what is heard together cannot be drawn together,
 * so the rule lives here rather than in either exercise.
 */
export function harmonicIntervalMei({
  lower,
  upper,
  clef,
  keySignature,
  hide,
}: HarmonicIntervalOptions): string {
  if (diatonicValue(lower) === diatonicValue(upper)) {
    return melodicIntervalMei({
      first: lower,
      second: upper,
      clef,
      keySignature,
      ...(hide === undefined ? {} : { hide: hide === 'lower' ? 'first' : 'second' }),
    })
  }

  return document(
    clef,
    keySignature,
    `<chord dur="1">
                    ${noteElement(lower, keySignature, '', hide === 'lower')}
                    ${noteElement(upper, keySignature, '', hide === 'upper')}
                  </chord>`,
  )
}

export interface MelodicIntervalOptions {
  /** In the order they are heard, which is also the order they are drawn. */
  first: Pitch
  second: Pitch
  clef: ClefId
  keySignature: KeySignatureId
  /** Engraved in place but not drawn, until the answer reveals it. */
  hide?: 'first' | 'second'
}

/**
 * Two notes side by side — a melodic interval.
 *
 * Drawn in the order they sound, so a descending interval reads downwards
 * across the staff exactly as it was played.
 */
export function melodicIntervalMei({
  first,
  second,
  clef,
  keySignature,
  hide,
}: MelodicIntervalOptions): string {
  return document(
    clef,
    keySignature,
    `${noteElement(first, keySignature, 'dur="2"', hide === 'first')}
                  ${noteElement(second, keySignature, 'dur="2"', hide === 'second')}`,
  )
}

export interface ScaleOptions {
  /** In the order they are drawn, which is the order they are played. */
  pitches: readonly Pitch[]
  clef: ClefId
  /**
   * Notes from this index onwards are engraved in place but not drawn. The
   * hearing exercise shows the note the scale starts from and hides the rest
   * until the answer is in.
   */
  hideFrom?: number
}

/**
 * A scale, as a run of quarter notes.
 *
 * **Always keyless.** A mode is read from the accidentals it prints against
 * the letters it uses, so a key signature would answer half the question
 * before it is asked: F♯ mixolydian under one sharp looks exactly like G
 * ionian does. Writing the signature into this function rather than taking
 * it as a parameter is what keeps that decision in one place.
 */
export function scaleMei({ pitches, clef, hideFrom }: ScaleOptions): string {
  const notes = pitches
    .map((pitch, index) =>
      noteElement(pitch, KEYLESS, 'dur="4"', hideFrom !== undefined && index >= hideFrom),
    )
    .join('\n                  ')

  return document(clef, KEYLESS, notes)
}
