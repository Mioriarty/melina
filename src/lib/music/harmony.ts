import {
  chordNotes,
  chordSize,
  isChordQuality,
  readChord,
  type Chord,
  type ChordQuality,
} from './chord'
import {
  figureKey,
  figurePitches,
  parseFigureKey,
  preferredFigure,
  type Figure,
} from './figuredBass'
import {
  figureNumberOf,
  isMinor,
  keyNotes,
  keySignatureOf,
  letterAbove,
  type Key,
} from './key'
import { alterationInKey } from './keySignature'
import { TICKS_PER_BEAT } from './meter'
import { isAlteration, type Pitch } from './pitch'
import { parseTonicKey, tonicKey, type PitchClass } from './scale'
import { voiceChord } from './voicing'

/**
 * A chord referred to a key — the layer between `chord.ts` and a progression.
 *
 * There are **two representations here and the boundary between them is the
 * whole design**:
 *
 * - A `ChordSpec` is the *plan*. A scale step, a quality, an inversion —
 *   nothing in it is a pitch. This is where meaning lives, and it is what the
 *   Satzmodelle in `satzmodell.ts` are written in.
 * - A `HarmonicEvent` is the *fact*. The sonority as spelled pitch classes
 *   over a bass, and how long it lasts. Key-independent, doubling-free,
 *   octave-free.
 *
 * **The plan generates downward and every reading derives upward.** From an
 * event you can recover the figure (`figuredBass.ts`, unchanged), the Stufe
 * (`chord.ts`'s `readChord`, unchanged) and the function symbol — which is
 * Karlsruhe's own exam task, *"notieren Sie diese entweder in
 * Generalbassziffern oder in Funktionszeichen oder in Stufenzeichen"*, falling
 * out of one model rather than being three implementations that can disagree.
 *
 * Nothing here carries a display string. A Stufe prints as `V7` and a function
 * as `D7`, and both of those are *notation* rather than language — they are
 * built in `lib/notation/harmonyNotation.ts`, exactly as a figure's printed
 * text is built in `figureNotation.ts` rather than in `figuredBass.ts`.
 */

/** The three functions a chord can stand in, for the grammar's own purposes. */
export type FunctionClass = 'T' | 'S' | 'D'

/* ----------------------------------------------------------------- the plan */

export interface ChordSpec {
  /** 1 to 7, read in `of`'s region when there is one. */
  degree: number
  /**
   * How far the root stands from the note the scale has there. The
   * Neapolitan's `♭II` is the whole reason this exists, and a spec that sets
   * it must name its `quality` too — an altered root is not a diatonic stack
   * and there is nothing to compute it from.
   */
  alteration?: -1 | 1
  /**
   * Which degree of the home key this chord is borrowed *to*: `{ degree: 5,
   * of: 5 }` is V/V. One level only — V/V/V is vanishingly rare and allowing
   * it would double the model for nothing.
   */
  of?: number
  /** Omitted means whatever the key spells on that step. */
  quality?: ChordQuality
  seventh?: boolean
  /**
   * Leave the mode alone — do not raise the leading note even on a degree
   * that ordinarily takes it.
   *
   * **A sequence is diatonic.** Inside a Quintfallsequenz the chord on the
   * fifth degree of a minor key is a passing `v`, not the dominant, and
   * raising its third puts an F♯ next to the F♮ of the chord after it — a
   * cross-relation, and an audible fault rather than a spelling quibble. The
   * leading note belongs to a real dominant, which is to say to a cadence, a
   * prolongation or an applied chord, and every one of those says so.
   */
  plain?: boolean
  inversion: number
  /**
   * Lines standing suspended over this bass, as figure numbers: `[4]` is a
   * 4–3, `[6, 4]` the cadential six-four. Each resolves down to the line
   * below it, which is what makes a suspension one spec rather than two.
   */
  suspend?: readonly number[]
  beats: number
}

/* ----------------------------------------------------------------- the fact */

export interface HarmonicEvent {
  bass: PitchClass
  /**
   * The notes above the bass, highest figure number first — the same shape
   * and order `figurePitches` returns, so the two are directly comparable.
   * The bass itself is not repeated here unless the sonority genuinely
   * doubles it at the octave.
   */
  upper: readonly PitchClass[]
  ticks: number
  /** The bass rings on from the previous event rather than being restruck. */
  held?: boolean
}

/**
 * Every distinct note of the sonority, **stacked upward from the bass**.
 *
 * `upper` is held highest-first, because that is the order a figure is read
 * down its column and the order `figurePitches` returns. A stack is read the
 * other way, so it is reversed here — the same turn `describeEvent` makes in
 * thoroughbass before handing a figure's notes to `voiceChord`.
 */
export function eventNotes(event: HarmonicEvent): readonly PitchClass[] {
  const notes: PitchClass[] = [event.bass]
  for (const note of [...event.upper].reverse()) {
    if (!notes.some((already) => tonicKey(already) === tonicKey(note))) notes.push(note)
  }
  return notes
}

/**
 * The sonority stacked upward from its bass, which is the form `readChord`
 * reads and the form a figure is realised into.
 */
export function eventPitches(event: HarmonicEvent): readonly Pitch[] {
  return voiceChord(eventNotes(event))
}

/* ------------------------------------------------------- building the fact */

/**
 * The quality of the plain triad or seventh chord the scale itself spells on a
 * degree — **computed by reading the stack back**, never tabulated, which is
 * the move `isCleanScale` and `isSymmetric` both make.
 */
function scaleStack(
  key: Key,
  degree: number,
  size: number,
): readonly PitchClass[] | undefined {
  const notes = keyNotes(key)
  if (notes === undefined) return undefined

  const stack: PitchClass[] = []
  for (let member = 0; member < size; member += 1) {
    const note = notes[(degree - 1 + member * 2) % 7]
    if (note === undefined) return undefined
    stack.push(note)
  }
  return stack
}

/**
 * The degrees whose chords carry the raised seventh in a minor key.
 *
 * **A convention, and a small one, so it is a table.** A minor key is written
 * under the natural minor's signature and raises its seventh where the harmony
 * needs a leading note — which is on the dominant and on the leading-note
 * chord, and nowhere else by default. Stating it as "these two degrees raise
 * the seventh scale degree wherever their stack contains it" rather than as a
 * quality per degree is what makes it fall out right for all four chords at
 * once: V becomes major, V7 a dominant seventh, vii° diminished, and vii°7 a
 * fully diminished seventh — the last of those because the natural sixth is
 * already where a diminished seventh wants it.
 *
 * ♭VII and III are deliberately not here. Both are ordinary chords of the
 * minor mode with the seventh left alone, and a block that wants III+ says so.
 */
const RAISED_DEGREES: readonly number[] = [5, 7]

function raiseLeadingNote(key: Key, stack: readonly PitchClass[]): readonly PitchClass[] {
  const seventh = keyNotes(key)?.[6]
  if (seventh === undefined) return stack

  return stack.map((note) => {
    if (note.letter !== seventh.letter || note.alteration !== seventh.alteration) {
      return note
    }
    const alteration = note.alteration + 1
    return isAlteration(alteration) ? { ...note, alteration } : note
  })
}

/** The quality a written stack spells, read back through `chord.ts`. */
export function qualityOf(notes: readonly PitchClass[]): ChordQuality | undefined {
  return readChord(voiceChord(notes))?.quality
}

/**
 * The region an applied chord is borrowed into.
 *
 * Its tonic is the note on that degree and its mode is **whichever the key's
 * own triad there is** — so `V/ii` in C is read in D minor and comes out A
 * major, because the dominant of a minor key raises its seventh by the rule
 * above. A degree carrying a diminished or augmented triad is no region at
 * all and returns `undefined`, which is the standard rule and is computed
 * rather than listed.
 */
export function appliedKey(key: Key, degree: number): Key | undefined {
  const stack = scaleStack(key, degree, 3)
  const tonic = stack?.[0]
  if (stack === undefined || tonic === undefined) return undefined

  const quality = qualityOf(stack)
  if (quality !== 'major' && quality !== 'minor') return undefined

  return { tonic, mode: quality === 'major' ? 'ionian' : 'aeolian' }
}

/** The chord a spec names: its root and its quality, both spelled. */
export function specChord(
  key: Key,
  spec: ChordSpec,
): { root: PitchClass; quality: ChordQuality } | undefined {
  const local = spec.of === undefined ? key : appliedKey(key, spec.of)
  if (local === undefined) return undefined

  const size = spec.seventh === true ? 4 : 3
  const plain = scaleStack(local, spec.degree, size)
  if (plain === undefined) return undefined

  const stack =
    isMinor(local) && spec.plain !== true && RAISED_DEGREES.includes(spec.degree)
      ? raiseLeadingNote(local, plain)
      : plain

  const step = stack[0]
  if (step === undefined) return undefined

  const shift = spec.alteration ?? 0
  const alteration = step.alteration + shift
  if (!isAlteration(alteration)) return undefined
  const root: PitchClass = { letter: step.letter, alteration }

  // An altered root is not a diatonic stack, so there is nothing to read the
  // quality off; a spec that shifts one has to say what it is building.
  const quality = spec.quality ?? (shift === 0 ? qualityOf(stack) : undefined)
  if (quality === undefined) return undefined
  if (chordSize(quality) !== size) return undefined

  return { root, quality }
}

/** Where the members of a chord stand: the bass, and everything above it. */
function invert(
  notes: readonly PitchClass[],
  inversion: number,
): { bass: PitchClass; upper: readonly PitchClass[] } | undefined {
  const bass = notes[inversion]
  if (bass === undefined) return undefined
  const upper = notes.filter((_, index) => index !== inversion)
  return { bass, upper }
}

/** Highest figure number first, which is how a sonority is read down a column. */
function byFigureNumber(
  bass: PitchClass,
  notes: readonly PitchClass[],
): readonly PitchClass[] {
  return [...notes].sort(
    (a, b) =>
      figureNumberOf(bass.letter, b.letter) - figureNumberOf(bass.letter, a.letter),
  )
}

/**
 * A suspension's sonority: the same chord with each suspended line standing a
 * step above where it resolves.
 *
 * Built by **substitution on the letters**, because that is what a suspension
 * is — a note held over from the chord before, sounding a step above the chord
 * tone it is about to become. The held note takes the key's own spelling,
 * which is what it had in the chord it was held from.
 */
function suspendOver(
  key: Key,
  bass: PitchClass,
  resolution: readonly PitchClass[],
  lines: readonly number[],
): readonly PitchClass[] | undefined {
  const signature = keySignatureOf(key)
  if (signature === undefined) return undefined

  const held: PitchClass[] = []

  for (const note of resolution) {
    const number = figureNumberOf(bass.letter, note.letter)
    const line = lines.find((candidate) => candidate - 1 === number)
    if (line === undefined) {
      held.push(note)
      continue
    }
    // **One line, taken directly.** Asking `figurePitches` for a lone `4`
    // would get back the whole stack that abbreviates to it — 5/4, not the
    // fourth alone — and the wrong note off the top of it.
    const letter = letterAbove(bass.letter, (line - 1) % 7)
    held.push({ letter, alteration: alterationInKey(letter, signature) })
  }

  // Every named line must actually have replaced something, or the spec is
  // describing a suspension the chord has no room for.
  const replaced = held.filter(
    (note, index) => tonicKey(note) !== tonicKey(resolution[index] as PitchClass),
  )
  if (replaced.length !== lines.length) return undefined

  return byFigureNumber(bass, held)
}

/**
 * The events a spec produces — one ordinarily, two when it suspends.
 *
 * A suspension is **two sonorities over one bass**, which is the shape
 * `BassEvent` in thoroughbass already has and the shape a figured `4 – 3`
 * writes down. Keeping the list flat rather than nesting them is what lets the
 * voicing search, the schedule and the stored form all treat a progression as
 * a run of sonorities; `held` records that the bass does not restrike, which
 * is the one thing flattening would otherwise lose.
 */
export function buildEvents(
  key: Key,
  spec: ChordSpec,
): readonly HarmonicEvent[] | undefined {
  const chord = specChord(key, spec)
  if (chord === undefined) return undefined

  const notes = chordNotes(chord.root, chord.quality)
  if (notes === undefined) return undefined

  const placed = invert(notes, spec.inversion)
  if (placed === undefined) return undefined

  const ticks = Math.round(spec.beats * TICKS_PER_BEAT)
  if (ticks <= 0) return undefined

  const resolution = byFigureNumber(placed.bass, placed.upper)
  const lines = spec.suspend
  if (lines === undefined || lines.length === 0) {
    return [{ bass: placed.bass, upper: resolution, ticks }]
  }

  const held = suspendOver(key, placed.bass, resolution, lines)
  if (held === undefined) return undefined

  // The bass is struck once and rings under both halves.
  const first = Math.round(ticks / 2)
  if (first <= 0 || ticks - first <= 0) return undefined

  return [
    { bass: placed.bass, upper: held, ticks: first },
    { bass: placed.bass, upper: resolution, ticks: ticks - first, held: true },
  ]
}

/* ------------------------------------------------------------ the readings */

/** The chord an event spells, or `undefined` where it is not a stack of thirds. */
export function eventChord(event: HarmonicEvent): Chord | undefined {
  return readChord(eventPitches(event))
}

/**
 * The figure an event is written under.
 *
 * `previous` is what stood under the same bass a moment ago, which is what
 * makes a suspension's resolution write only the line that moved — the rule
 * `canonicalFigures` already states.
 */
export function eventFigure(
  key: Key,
  event: HarmonicEvent,
  previous?: HarmonicEvent,
): Figure | undefined {
  const signature = keySignatureOf(key)
  if (signature === undefined) return undefined

  const bass: Pitch = { ...event.bass, octave: 4 }
  const after = previous !== undefined && event.held === true
  return preferredFigure(bass, signature, event.upper, {
    afterAnother: after,
    ...(after ? { previous: previous.upper } : {}),
  })
}

export interface Stufe {
  /** 1 to 7. */
  number: number
  /** How far the root stands from the scale's own note there. `♭II` is −1. */
  alteration: number
  quality: ChordQuality
  inversion: number
}

/** Which step of the key an event stands on, read back from its own notes. */
export function eventStufe(key: Key, event: HarmonicEvent): Stufe | undefined {
  const chord = eventChord(event)
  const notes = keyNotes(key)
  if (chord === undefined || notes === undefined) return undefined

  const index = notes.findIndex((step) => step.letter === chord.root.letter)
  const step = notes[index]
  if (step === undefined) return undefined

  return {
    number: index + 1,
    alteration: chord.root.alteration - step.alteration,
    quality: chord.quality,
    inversion: chord.inversion,
  }
}

/**
 * A Riemann function symbol, as a shape rather than as text.
 *
 * `harmonyNotation.ts` prints it and the `harmony` locale names it out loud,
 * for the reason every other name in `lib/music` is elsewhere: `Tp` is the
 * Tonikaparallele, and a sentence assembled from English parts does not
 * survive the translation.
 */
export interface FunctionSymbol {
  base: FunctionClass
  /** Lower case — a minor tonic is `t`, a minor subdominant `s`. */
  minor: boolean
  /** The parallel chord: `Tp`, `sP`. */
  parallel?: boolean
  seventh?: boolean
  /** The leading-note chord, read as a dominant seventh without its root. */
  incomplete?: boolean
  inversion: number
}

/**
 * Stufe to function, keyed by degree, alteration and quality.
 *
 * **A table, because Funktionstheorie is a convention** — the same reason
 * `STACKS` and `INVERSION_FIGURES` are tables. Riemann's mapping is not
 * arithmetic over the scale; it is a reading somebody proposed and a tradition
 * adopted.
 *
 * It is deliberately **incomplete**, and returns `undefined` rather than
 * inventing a symbol. Several chords genuinely have no agreed one — the
 * diminished triad on the second degree of a minor key is written four
 * different ways by four textbooks — and `undefined` says so honestly. The
 * Stufen reading always works, so nothing is lost by admitting it.
 */
const FUNCTIONS: readonly {
  mode: 'ionian' | 'aeolian'
  degree: number
  alteration: number
  quality: ChordQuality
  symbol: Omit<FunctionSymbol, 'inversion' | 'seventh'>
}[] = [
  {
    mode: 'ionian',
    degree: 1,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'T', minor: false },
  },
  {
    mode: 'ionian',
    degree: 2,
    alteration: 0,
    quality: 'minor',
    symbol: { base: 'S', minor: false, parallel: true },
  },
  {
    mode: 'ionian',
    degree: 3,
    alteration: 0,
    quality: 'minor',
    symbol: { base: 'D', minor: false, parallel: true },
  },
  {
    mode: 'ionian',
    degree: 4,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'S', minor: false },
  },
  {
    mode: 'ionian',
    degree: 5,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'D', minor: false },
  },
  {
    mode: 'ionian',
    degree: 5,
    alteration: 0,
    quality: 'dominant-seventh',
    symbol: { base: 'D', minor: false },
  },
  {
    mode: 'ionian',
    degree: 6,
    alteration: 0,
    quality: 'minor',
    symbol: { base: 'T', minor: false, parallel: true },
  },
  {
    mode: 'ionian',
    degree: 7,
    alteration: 0,
    quality: 'diminished',
    symbol: { base: 'D', minor: false, incomplete: true },
  },
  {
    mode: 'ionian',
    degree: 7,
    alteration: 0,
    quality: 'half-diminished-seventh',
    symbol: { base: 'D', minor: false, incomplete: true },
  },

  {
    mode: 'aeolian',
    degree: 1,
    alteration: 0,
    quality: 'minor',
    symbol: { base: 'T', minor: true },
  },
  {
    mode: 'aeolian',
    degree: 3,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'T', minor: true, parallel: true },
  },
  {
    mode: 'aeolian',
    degree: 4,
    alteration: 0,
    quality: 'minor',
    symbol: { base: 'S', minor: true },
  },
  {
    mode: 'aeolian',
    degree: 5,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'D', minor: false },
  },
  {
    mode: 'aeolian',
    degree: 5,
    alteration: 0,
    quality: 'dominant-seventh',
    symbol: { base: 'D', minor: false },
  },
  {
    mode: 'aeolian',
    degree: 6,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'S', minor: true, parallel: true },
  },
  {
    mode: 'aeolian',
    degree: 7,
    alteration: 0,
    quality: 'major',
    symbol: { base: 'D', minor: true, parallel: true },
  },
  {
    mode: 'aeolian',
    degree: 7,
    alteration: 1,
    quality: 'diminished',
    symbol: { base: 'D', minor: false, incomplete: true },
  },
  {
    mode: 'aeolian',
    degree: 7,
    alteration: 1,
    quality: 'diminished-seventh',
    symbol: { base: 'D', minor: false, incomplete: true },
  },
]

export function stufeFunction(key: Key, stufe: Stufe): FunctionSymbol | undefined {
  const mode = isMinor(key) ? 'aeolian' : 'ionian'
  const found = FUNCTIONS.find(
    (entry) =>
      entry.mode === mode &&
      entry.degree === stufe.number &&
      entry.alteration === stufe.alteration &&
      entry.quality === stufe.quality,
  )
  if (found === undefined) return undefined

  return {
    ...found.symbol,
    ...(chordSize(stufe.quality) === 4 ? { seventh: true } : {}),
    inversion: stufe.inversion,
  }
}

export function eventFunction(
  key: Key,
  event: HarmonicEvent,
): FunctionSymbol | undefined {
  const stufe = eventStufe(key, event)
  return stufe === undefined ? undefined : stufeFunction(key, stufe)
}

/**
 * Which of the three functions a chord stands in, for the grammar to match on.
 *
 * Coarser than `stufeFunction` and total where that one is partial, because
 * the backwards walk has to be able to ask "may this stand before a dominant"
 * of **every** chord it can produce. Read off the degree alone, which is the
 * reading the entry constraints in `satzmodell.ts` are written against.
 */
const CLASSES: Readonly<Record<number, FunctionClass>> = {
  1: 'T',
  2: 'S',
  3: 'T',
  4: 'S',
  5: 'D',
  6: 'T',
  7: 'D',
}

export function degreeClass(degree: number): FunctionClass | undefined {
  return CLASSES[degree]
}

export function eventClass(key: Key, event: HarmonicEvent): FunctionClass | undefined {
  const stufe = eventStufe(key, event)
  return stufe === undefined ? undefined : degreeClass(stufe.number)
}

/* ------------------------------------------------------------- stored form

   Three parallel strings, following `FiguredBassAttempt` exactly: `,` between
   bass notes, `-` between successive figures under one bass, `/` between the
   lines of one figure. Every separator is a character no value contains.

   **A progression is stored as a figured bass**, and that is the best result
   in this file: `preferredFigure` and `figurePitches` are exact inverses and
   already round-trip tested, so the notes, the chord, the Stufe, the function
   and the four voices are all derived on the way back out and a row cannot
   disagree with itself. It also means the chromatic chords cost nothing — a
   German sixth is `♯6/5` over a flattened sixth, which is a stack `STACKS`
   already holds. */

const BASS_SEPARATOR = ','
const FIGURE_SEPARATOR = '-'

export interface StoredProgression {
  bass: string
  figures: string
  beats: string
}

export function eventsKey(
  key: Key,
  events: readonly HarmonicEvent[],
): StoredProgression | undefined {
  const bass: string[] = []
  const figures: string[] = []
  const beats: string[] = []

  let previous: HarmonicEvent | undefined
  for (const event of events) {
    const figure = eventFigure(key, event, previous)
    if (figure === undefined) return undefined

    const written = figureKey(figure)
    const ticks = String(event.ticks)

    if (event.held === true && bass.length > 0) {
      figures[figures.length - 1] += `${FIGURE_SEPARATOR}${written}`
      beats[beats.length - 1] += `${FIGURE_SEPARATOR}${ticks}`
    } else {
      bass.push(tonicKey(event.bass))
      figures.push(written)
      beats.push(ticks)
    }
    previous = event
  }

  return {
    bass: bass.join(BASS_SEPARATOR),
    figures: figures.join(BASS_SEPARATOR),
    beats: beats.join(BASS_SEPARATOR),
  }
}

export function parseEvents(
  key: Key,
  stored: StoredProgression,
): readonly HarmonicEvent[] | undefined {
  const signature = keySignatureOf(key)
  if (signature === undefined) return undefined

  const basses = stored.bass.split(BASS_SEPARATOR)
  const columns = stored.figures.split(BASS_SEPARATOR)
  const spans = stored.beats.split(BASS_SEPARATOR)
  if (columns.length !== basses.length || spans.length !== basses.length) return undefined

  const events: HarmonicEvent[] = []

  for (const [index, written] of basses.entries()) {
    const note = parseTonicKey(written)
    if (note === undefined) return undefined

    const column = columns[index]
    const span = spans[index]
    if (column === undefined || span === undefined) return undefined

    const parts = column.split(FIGURE_SEPARATOR)
    const lengths = span.split(FIGURE_SEPARATOR)
    if (lengths.length !== parts.length) return undefined

    for (const [position, text] of parts.entries()) {
      const figure = parseFigureKey(text)
      const ticks = Number(lengths[position])
      if (figure === undefined || !Number.isInteger(ticks) || ticks <= 0) return undefined

      const upper = figurePitches({ ...note, octave: 4 }, signature, figure)
      if (upper === undefined) return undefined

      events.push({
        bass: note,
        upper,
        ticks,
        ...(position > 0 ? { held: true } : {}),
      })
    }
  }

  return events
}

/** Guard for a stored quality read back off a settings blob. */
export function isQuality(value: string): boolean {
  return isChordQuality(value)
}
