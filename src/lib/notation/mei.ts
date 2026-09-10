import { getClef, type ClefId } from '@/lib/music/clef'
import { ticksPerMeasure, type TimeSignature } from '@/lib/music/meter'
import {
  notatedTicks,
  onsetsOf,
  padding,
  type NoteValue,
  type RhythmNode,
  type RhythmSymbol,
} from '@/lib/notation/rhythmNotation'
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
 * The glyphs that *cancel* one accidental and put another in its place.
 *
 * Reducing a double sharp to a single one is not a plain sharp: the sharp
 * already in force is what has to be taken back first, so it is written ♮♯,
 * which SMuFL and MEI both carry as one glyph. Only these two combinations
 * arise — anything cancelled to a natural is a plain natural, and anything
 * raised further already reads correctly on its own.
 */
const CANCELLING_ACCIDENTALS: Partial<Record<Alteration, string>> = {
  [-1]: 'nf',
  1: 'ns',
}

/**
 * How a note is written once the bar so far is taken into account.
 *
 * **An accidental holds until the barline.** A staff position that has been
 * altered stays altered for every later note on it, so what has to be printed
 * is not "does this note disagree with the key signature" but "does it
 * disagree with what is currently in force there" — the key signature only
 * says what is in force before anything else has happened.
 *
 * Getting this wrong is invisible to a type checker and nearly invisible on
 * the page: a note simply inherits the accidental of the one before it and
 * reads as a different pitch. A B major melody touching A𝄪 and then A♯ drew
 * the second one bare, which reads as another A𝄪.
 *
 * State is per staff position — letter *and* octave — because that is what an
 * accidental applies to.
 */
function measureAccidentals(
  pitches: readonly Pitch[],
  keySignature: KeySignatureId,
): string[] {
  const inForce = new Map<string, Alteration>()

  return pitches.map((value) => {
    const place = `${value.letter}${value.octave}`
    const standing = inForce.get(place) ?? alterationInKey(value.letter, keySignature)

    if (value.alteration === standing) {
      return ` accid.ges="${GESTURAL_ACCIDENTALS[value.alteration]}"`
    }

    inForce.set(place, value.alteration)

    // Taking back a double accidental needs the cancelling form; everything
    // else is simply the accidental itself.
    const cancelling =
      Math.abs(standing) === 2 && Math.sign(standing) === Math.sign(value.alteration)
        ? CANCELLING_ACCIDENTALS[value.alteration]
        : undefined

    return ` accid="${cancelling ?? WRITTEN_ACCIDENTALS[value.alteration]}"`
  })
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
function envelope(scoreDef: string, measure: string): string {
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
          ${scoreDef}
          <section>
            ${measure}
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`
}

function document(clef: ClefId, keySignature: KeySignatureId, layer: string): string {
  const { sign, line } = getClef(clef)

  return envelope(
    `<scoreDef keysig="${meiKeySignature(keySignature)}">
            <staffGrp>
              <staffDef n="1" lines="5" clef.shape="${sign}" clef.line="${line}"/>
            </staffGrp>
          </scoreDef>`,
    `<measure n="1" right="invis">
              <staff n="1">
                <layer n="1">
                  ${layer}
                </layer>
              </staff>
            </measure>`,
  )
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

/* ------------------------------------------------------------------ rhythm

   A rhythm is drawn on a single line with a percussion clef: there is no pitch
   to read, so five lines would be four lines of nothing. Everything below is
   engraving only — what is *graded* is the impacts, and those never come from
   here. See `lib/notation/rhythmNotation.ts`. */

export interface RhythmStaffOptions {
  /** The spelling, from `notateRhythm`. */
  nodes: readonly RhythmNode[]
  /**
   * Drawn at the left of the staff. Passed in already translated, the same way
   * pitches are passed in already spelled — this module still names nothing.
   */
  label?: string
}

export interface RhythmMeiOptions {
  meter: TimeSignature
  /**
   * One staff, or two when a wrong answer is shown against the right one. Two
   * share a measure rather than being two renders, so their barlines line up
   * and the same impact sits at the same x on both.
   */
  staves: readonly RhythmStaffOptions[]
}

/** A staff label is the one string that reaches this module from outside. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined || value === 0 ? '' : ` ${name}="${value}"`
}

/**
 * A note that has not been typed yet.
 *
 * `<space>` occupies its duration and draws nothing, which is what lets a
 * half-typed bar still be a *full* bar. That matters more than it sounds:
 * Verovio spaces a measure by what is in it, so without the padding every
 * keystroke would re-space the notes already on screen and they would crawl
 * sideways under the player's hands.
 */
function spaceElement(symbol: RhythmSymbol): string {
  return `<space dur="${symbol.dur}"${attribute('dots', symbol.dots)}/>`
}

function nodeElement(node: RhythmNode): string {
  if (node.kind === 'beam')
    return `<beam>${node.children.map(nodeElement).join('')}</beam>`

  if (node.kind === 'tuplet') {
    return (
      `<tuplet num="${node.num}" numbase="${node.numbase}" bracket.place="above" num.place="above">` +
      `${node.children.map(nodeElement).join('')}</tuplet>`
    )
  }

  const dots = attribute('dots', node.dots)
  // `@loc` is a staff position rather than a pitch, which is what an unpitched
  // note has: 0 is the single line the whole rhythm sits on.
  //
  // Stems point **down**, and that is load-bearing rather than taste. The page
  // is laid out from the top, so anything drawn above the staff pushes the
  // staff down to make room — and with stems up, a bar filling with beams moved
  // its own staff line by some 40px as it was typed. Hanging the stems below
  // means the bar grows downwards into space that is already reserved, and the
  // line stays exactly where it was. `rhythmVerovio.test.ts` holds it there.
  return node.kind === 'rest'
    ? `<rest dur="${node.dur}"${dots} loc="0"/>`
    : `<note dur="${node.dur}"${dots} loc="0" stem.dir="down"/>`
}

/**
 * A rhythm, on one line, under a time signature and no key signature.
 *
 * The bar is always padded to its full length, so the measure Verovio lays out
 * is the same measure however much of it has been typed.
 */
export function rhythmMei({ meter, staves }: RhythmMeiOptions): string {
  const total = ticksPerMeasure(meter)

  const staffDefs = staves
    .map((staff, index) => {
      const label =
        staff.label === undefined ? '' : `<label>${escapeText(staff.label)}</label>`
      const attributes = `n="${index + 1}" lines="1" clef.shape="perc" clef.line="1"`
      return label === ''
        ? `<staffDef ${attributes}/>`
        : `<staffDef ${attributes}>${label}</staffDef>`
    })
    .join('\n              ')

  const layers = staves
    .map((staff, index) => {
      const written = notatedTicks(staff.nodes)
      const rest = padding(meter, written, total).map(spaceElement).join('')
      const layer = staff.nodes.map(nodeElement).join('') + rest

      return `<staff n="${index + 1}">
                <layer n="1">${layer}</layer>
              </staff>`
    })
    .join('\n              ')

  return envelope(
    `<scoreDef meter.count="${meter.beats}" meter.unit="${meter.unit}">
            <staffGrp>
              ${staffDefs}
            </staffGrp>
          </scoreDef>`,
    `<measure n="1">
              ${layers}
            </measure>`,
  )
}

/* ------------------------------------------------------------------ degrees

   Scale degree identification writes its answer on a staff under a key
   signature, the way the melody it heard would be written. Everything here is
   engraving: what is *graded* is the degrees, which never come from here. */

export interface MelodyStaffOptions {
  /** The notes entered so far, in the order they are drawn. */
  pitches: readonly Pitch[]
  /** Drawn at the left. Passed in already translated, like every other string. */
  label?: string
}

export interface MelodyMeiOptions {
  clef: ClefId
  keySignature: KeySignatureId
  /**
   * How many notes the answer will have.
   *
   * The tail is padded out to this with `<space>`, so a half-written answer is
   * still a full-length measure — which is what keeps the notes already on the
   * staff from re-spacing under the player's hands as more arrive. The same
   * lesson `rhythmMei` learned, for the same reason.
   */
  slots: number
  /** One staff, or two when a wrong answer is shown against the right one. */
  staves: readonly MelodyStaffOptions[]
}

/**
 * A melody of even notes under a key signature.
 *
 * No meter and no barlines: the melody has no rhythm, and drawing one would
 * ask a second question. Quarter noteheads are simply the plainest thing to
 * write a pitch on.
 */
export function melodyMei({
  clef,
  keySignature,
  slots,
  staves,
}: MelodyMeiOptions): string {
  const { sign, line } = getClef(clef)

  const staffDefs = staves
    .map((staff, index) => {
      const attributes = `n="${index + 1}" lines="5" clef.shape="${sign}" clef.line="${line}"`
      return staff.label === undefined
        ? `<staffDef ${attributes}/>`
        : `<staffDef ${attributes}><label>${escapeText(staff.label)}</label></staffDef>`
    })
    .join('\n              ')

  const layers = staves
    .map((staff, index) => {
      // One measure, so an accidental printed on a staff position stays in
      // force for every later note on it — see `measureAccidentals`.
      const accidentals = measureAccidentals(staff.pitches, keySignature)
      const notes = staff.pitches
        .map(
          (pitch, at) =>
            `<note pname="${pitch.letter.toLowerCase()}" oct="${pitch.octave}" dur="4"${accidentals[at] ?? ''}/>`,
        )
        .join('')
      const padding = '<space dur="4"/>'.repeat(Math.max(0, slots - staff.pitches.length))

      return `<staff n="${index + 1}">
                <layer n="1">${notes}${padding}</layer>
              </staff>`
    })
    .join('\n              ')

  return envelope(
    `<scoreDef keysig="${meiKeySignature(keySignature)}">
            <staffGrp>
              ${staffDefs}
            </staffGrp>
          </scoreDef>`,
    `<measure n="1" right="invis">
              ${layers}
            </measure>`,
  )
}

/* ------------------------------------------------------- melodic dictation

   The two halves at once: a run of bars in a metre, each note carrying a
   pitch. Everything here is engraving — what is graded is the impacts and the
   sounding pitches, neither of which comes from this file. */

export interface MelodicStaffOptions {
  /**
   * The spelling, one list of nodes per bar. Always as many lists as the
   * finished answer will have bars, empty ones included: a bar that has not
   * been reached yet still has to occupy its width, or the notes already
   * written would re-space the moment it was.
   */
  bars: readonly (readonly RhythmNode[])[]
  /** One per note, in the order they sound, across the whole phrase. */
  pitches: readonly Pitch[]
  /** Drawn at the left. Passed in already translated, like every other string. */
  label?: string
}

export interface MelodicPhraseMeiOptions {
  meter: TimeSignature
  clef: ClefId
  keySignature: KeySignatureId
  /**
   * How many bars share one system.
   *
   * **Encoded rather than left to the engraver.** Verovio decides where to
   * break by what will fit, so a half-written phrase would sit on one system
   * and jump to two the moment a bar grew — the staff resizing under the
   * player's hands, which is the exact failure the fixed page exists to stop.
   * A `<sb/>` says where the line ends whatever is on it.
   */
  barsPerSystem: number
  /** One staff, or two when a wrong answer is shown against the right one. */
  staves: readonly MelodicStaffOptions[]
}

/**
 * How many notes a bar's spelling holds, which is how many pitches it eats.
 *
 * Read off the spelling rather than counted separately, so the pitches cannot
 * drift out of step with the noteheads they belong to.
 */
function notesIn(nodes: readonly RhythmNode[]): number {
  return onsetsOf(nodes).length
}

/**
 * One bar's worth of nodes, with each note wearing the next pitch.
 *
 * `take` hands out pitches in order and `accidentals` was computed for this
 * bar alone — see `measureAccidentals`, and the barline that resets it.
 */
function melodicNodeElement(
  node: RhythmNode,
  take: () => { pitch: Pitch | undefined; accidental: string },
): string {
  if (node.kind === 'beam') {
    return `<beam>${node.children.map((child) => melodicNodeElement(child, take)).join('')}</beam>`
  }

  if (node.kind === 'tuplet') {
    return (
      `<tuplet num="${node.num}" numbase="${node.numbase}" bracket.place="above" num.place="above">` +
      `${node.children.map((child) => melodicNodeElement(child, take)).join('')}</tuplet>`
    )
  }

  const dots = attribute('dots', node.dots)
  if (node.kind === 'rest') return `<rest dur="${node.dur}"${dots}/>`

  const { pitch, accidental } = take()
  // A note with no pitch behind it cannot happen — every note entry carries
  // one — so this draws a rest rather than throwing inside a render.
  if (pitch === undefined) return `<rest dur="${node.dur}"${dots}/>`

  return `<note pname="${pitch.letter.toLowerCase()}" oct="${pitch.octave}" dur="${node.dur}"${dots}${accidental}/>`
}

/**
 * A melody: bars of pitched notes under a key signature and a time signature.
 *
 * **The key signature is printed here, unlike a scale.** A scale must be
 * keyless because the mode is read off its accidentals; a melody's key is told
 * to the player above the staff instead, so writing the signature is what makes
 * the notation read the way the melody would actually be written down.
 *
 * **Accidentals reset at every barline**, which is the whole reason this cannot
 * reuse `melodyMei`: that writes one measure, so its `measureAccidentals` runs
 * once over everything. Here each bar gets its own, and a note repeated across
 * a barline prints its accidental again — which is what the notation means.
 */
export function melodicPhraseMei({
  meter,
  clef,
  keySignature,
  barsPerSystem,
  staves,
}: MelodicPhraseMeiOptions): string {
  const { sign, line } = getClef(clef)
  const total = ticksPerMeasure(meter)
  const barCount = staves[0]?.bars.length ?? 0

  const staffDefs = staves
    .map((staff, index) => {
      const attributes = `n="${index + 1}" lines="5" clef.shape="${sign}" clef.line="${line}"`
      return staff.label === undefined
        ? `<staffDef ${attributes}/>`
        : `<staffDef ${attributes}><label>${escapeText(staff.label)}</label></staffDef>`
    })
    .join('\n              ')

  /** Where each staff's pitches have been used up to, bar by bar. */
  const consumed = staves.map(() => 0)

  const measures = Array.from({ length: barCount }, (_, bar) => {
    const layers = staves
      .map((staff, index) => {
        const nodes = staff.bars[bar] ?? []
        const from = consumed[index] ?? 0
        const count = notesIn(nodes)
        const pitches = staff.pitches.slice(from, from + count)
        consumed[index] = from + count

        // One bar at a time, so an accidental printed in this bar governs the
        // rest of it and nothing beyond it.
        const accidentals = measureAccidentals(pitches, keySignature)
        let at = 0
        const take = () => {
          const pitch = pitches[at]
          const accidental = accidentals[at] ?? ''
          at += 1
          return { pitch, accidental }
        }

        const written = notatedTicks(nodes)
        const rest = padding(meter, written, total).map(spaceElement).join('')
        const layer = nodes.map((node) => melodicNodeElement(node, take)).join('') + rest

        return `<staff n="${index + 1}">
                <layer n="1">${layer}</layer>
              </staff>`
      })
      .join('\n              ')

    // The closing barline is hidden only on the last bar, so the phrase reads
    // as a fragment rather than as a finished piece — the same reason every
    // other example here hides its own.
    const right = bar === barCount - 1 ? ' right="invis"' : ''
    const measure = `<measure n="${bar + 1}"${right}>
              ${layers}
            </measure>`

    // A break before every bar that starts a new system, never before the
    // first — a leading `<sb/>` would open the score with an empty line.
    const brk = bar > 0 && bar % barsPerSystem === 0 ? '<sb/>\n            ' : ''
    return `${brk}${measure}`
  }).join('\n            ')

  return envelope(
    `<scoreDef keysig="${meiKeySignature(keySignature)}" meter.count="${meter.beats}" meter.unit="${meter.unit}">
            <staffGrp>
              ${staffDefs}
            </staffGrp>
          </scoreDef>`,
    measures,
  )
}

/**
 * How a note is written on a key.
 *
 * With its stem, like any other note. An earlier draft left the stem off to
 * win back height, on the reasoning that a stem is three staff spaces the
 * notehead then has to share. Measured, that was wrong: the page has to be
 * sized for the *worst* case, and the worst case is a degree two ledger lines
 * below the staff — A flat 3 in the treble — whose ledger lines reach further
 * than any stem does. Dropping the stem therefore bought no room at all, and
 * cost the key a notehead that looked like no note in any notation.
 *
 * The value is a plain quarter unless the caller asks otherwise. Melodic
 * dictation does: there a pitch key writes whatever the note-value row has
 * armed, so the key draws that — a dotted half if a dotted half is what
 * pressing it would put on the staff.
 */
function keyNote(dur: NoteValue, dots: 0 | 1): string {
  return `dur="${dur}"${attribute('dots', dots)}`
}

/**
 * One note on a bare staff — a key on the degree keyboard.
 *
 * **No clef and no printed key signature.** The staff above already carries
 * both, and repeating them on seven small keys is noise that leaves no room for
 * the note itself. The signature is still *in force*, which is the point: a
 * degree that agrees with the key draws a plain notehead, and only one that has
 * been raised or lowered out of it prints an accidental.
 */
export function degreeKeyMei({
  pitch,
  clef,
  keySignature,
  dur = 4,
  dots = 0,
}: {
  pitch: Pitch
  clef: ClefId
  keySignature: KeySignatureId
  dur?: NoteValue
  dots?: 0 | 1
}): string {
  const { sign, line } = getClef(clef)

  return envelope(
    `<scoreDef keysig="${meiKeySignature(keySignature)}">
            <staffGrp>
              <staffDef n="1" lines="5" clef.shape="${sign}" clef.line="${line}" clef.visible="false" keysig.visible="false"/>
            </staffGrp>
          </scoreDef>`,
    `<measure n="1" right="invis">
              <staff n="1">
                <layer n="1">${noteElement(pitch, keySignature, keyNote(dur, dots))}</layer>
              </staff>
            </measure>`,
  )
}
