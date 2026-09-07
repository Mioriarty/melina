import { getClef, type ClefId } from '@/lib/music/clef'
import {
  alterationInKey,
  meiKeySignature,
  type KeySignatureId,
} from '@/lib/music/keySignature'
import type { Alteration, Pitch } from '@/lib/music/pitch'

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
}

const ACCIDENTAL_NAMES: Record<Alteration, string> = {
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
  const name = ACCIDENTAL_NAMES[value.alteration]

  return value.alteration === implied ? ` accid.ges="${name}"` : ` accid="${name}"`
}

function noteElement(value: Pitch, keySignature: KeySignatureId, duration = ''): string {
  const pname = value.letter.toLowerCase()
  const dur = duration === '' ? '' : ` ${duration}`
  return `<note pname="${pname}" oct="${value.octave}"${dur}${accidentalAttributes(value, keySignature)}/>`
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

/** Two notes stacked as a chord — a harmonic interval. */
export function harmonicIntervalMei({
  lower,
  upper,
  clef,
  keySignature,
}: HarmonicIntervalOptions): string {
  return document(
    clef,
    keySignature,
    `<chord dur="1">
                    ${noteElement(lower, keySignature)}
                    ${noteElement(upper, keySignature)}
                  </chord>`,
  )
}

export interface SingleNoteOptions {
  pitch: Pitch
  clef: ClefId
  keySignature: KeySignatureId
}

/**
 * One note alone.
 *
 * Used by the hearing exercise, which shows the note it starts from and only
 * reveals its partner once the answer is in.
 */
export function singleNoteMei({ pitch, clef, keySignature }: SingleNoteOptions): string {
  return document(clef, keySignature, noteElement(pitch, keySignature, 'dur="1"'))
}

export interface MelodicIntervalOptions {
  /** In the order they are heard, which is also the order they are drawn. */
  first: Pitch
  second: Pitch
  clef: ClefId
  keySignature: KeySignatureId
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
}: MelodicIntervalOptions): string {
  return document(
    clef,
    keySignature,
    `${noteElement(first, keySignature, 'dur="2"')}
                  ${noteElement(second, keySignature, 'dur="2"')}`,
  )
}
