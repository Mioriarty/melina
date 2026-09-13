import type { ChordQuality } from './chord'
import { buildEvents, type ChordSpec, type FunctionClass } from './harmony'
import { degreeClass } from './harmony'
import { keyKey, type Key } from './key'
import type { ModeId } from './scale'

/**
 * The Satztechniken a progression is built out of.
 *
 * **A progression is a stack of named blocks, not a chain of chords**, and
 * that is the whole of what makes one meaningful. A generator that picks
 * chords one at a time produces progressions that arrive nowhere, contain no
 * technique anybody has a name for, and — worst for an app — carry no label,
 * so nothing downstream can say what the player just heard.
 *
 * There are exactly **two mechanisms** here, and between them they express the
 * twenty-odd Satzmodelle the literature names:
 *
 * - a **fixed schema**, a stored run of chords relative to a starting degree.
 *   Cadences, prolongations, approaches and the Romanesca-family basses are
 *   all this one shape, differing only in `kind` and in where they may stand.
 * - a **transposition sequence**, a unit plus a step plus a repeat count.
 *   Quintfall, Quintanstieg, Monte, Fonte, Fauxbourdon and the Konsekutiven
 *   are all this one shape.
 *
 * Widening the vocabulary is therefore adding **rows**, never code — which is
 * the same promise `STACKS` and `MEMBER_INTERVALS` make.
 */

export type SatztechnikId =
  // openings
  | 'eroeffnung-tonika'
  // prolongations
  | 'tonika-prolongation'
  | 'tonika-sextakkord'
  | 'dominant-prolongation'
  | 'subdominant-prolongation'
  | 'durchgangs-quartsext'
  | 'wechsel-quartsext'
  // models
  | 'quintfall'
  | 'quintfall-septakkorde'
  | 'quintanstieg'
  | 'monte'
  | 'fonte'
  | 'fauxbourdon'
  // approaches
  | 'zwischendominante'
  | 'doppeldominante'
  | 'neapolitaner'
  // cadences
  | 'ganzschluss-vollkommen'
  | 'ganzschluss-unvollkommen'
  | 'kadenz-quartsext'
  | 'halbschluss'
  | 'phrygischer-halbschluss'
  | 'trugschluss'
  | 'plagalschluss'
  // the walk
  | 'frei'

export type BlockKind =
  'opening' | 'prolongation' | 'model' | 'approach' | 'cadence' | 'free'

/**
 * One chord of a block, written relative to the block's own starting degree.
 *
 * `offset` counts **diatonic steps**, so a block reads the same whatever
 * degree it is placed on and a sequence is the same unit moved along.
 */
export interface RelativeEvent {
  /** Steps from the block's origin. 0 is the origin itself. */
  offset: number
  /**
   * Read this chord as the dominant — or the leading-note chord — *of* the
   * degree at `offset` rather than as the degree itself. The value is the
   * degree within the tonicised region: 5 for `V/x`, 7 for `vii°/x`.
   *
   * One field rather than four, which is what collapses Zwischendominante,
   * Zwischendominantseptakkord, Sekundär-dvii and Zwischensubdominante into
   * one mechanism.
   */
  applied?: number
  alteration?: -1 | 1
  quality?: ChordQuality
  seventh?: boolean
  /** Stay in the mode: a sequence does not raise the leading note. */
  plain?: boolean
  inversion?: number
  suspend?: readonly number[]
  /**
   * Which chord member must stand in the soprano: 0 the root, 1 the third, 2
   * the fifth. This is what tells a *vollkommener* Ganzschluss from an
   * *unvollkommener* — one cadence with a constraint rather than two cadences
   * — and it is also the "beginnen Sie in der angegebenen Lage" a written
   * exam task sets. The voicing search honours it; nothing else reads it.
   */
  soprano?: number
  beats?: number
}

export interface HarmonicBlock {
  id: SatztechnikId
  kind: BlockKind
  /** Which modes the block belongs to. */
  modes: readonly ModeId[]
  /** Which degrees it may stand on. */
  origins: readonly number[]
  /** How likely it is to be reached for, against its siblings of the same kind. */
  weight: number
  /** A fixed schema. */
  events?: readonly RelativeEvent[]
  /** A transposition sequence: this unit, moved by `step`, this many times. */
  sequence?: {
    unit: readonly RelativeEvent[]
    /** Diatonic steps the origin moves between links. */
    step: number
    links: readonly number[]
  }
}

const BOTH: readonly ModeId[] = ['ionian', 'aeolian']
const MINOR: readonly ModeId[] = ['aeolian']
const ANY_DEGREE: readonly number[] = [1, 2, 3, 4, 5, 6, 7]
const TONIC: readonly number[] = [1]

/**
 * Degrees an applied chord may be borrowed to.
 *
 * **Not the tonic**, because the dominant of the tonic is simply the dominant
 * and calling it a Zwischendominante would be a label that teaches the wrong
 * thing; **not the fifth**, because that is the Doppeldominante and has a
 * block of its own. Which of the rest actually has a region is computed per
 * key rather than listed — a diminished degree is no key to be borrowed into.
 */
const TONICISABLE: readonly number[] = [2, 3, 4, 6]

/**
 * Every block the app ships.
 *
 * The **core ladder**, deliberately: enough to sound like music and to
 * exercise every mechanism, and small enough that the weights can be tuned by
 * listening rather than guessed at. Romanesca, Folia, Lamentobass, the
 * Konsekutiven, the Oktavregel and the augmented sixths are all expressible in
 * exactly these two shapes and are rows waiting to be written.
 */
export const BLOCKS: readonly HarmonicBlock[] = [
  /* --------------------------------------------------------------- openings */
  {
    id: 'eroeffnung-tonika',
    kind: 'opening',
    modes: BOTH,
    origins: TONIC,
    weight: 5,
    events: [{ offset: 0, soprano: 0 }],
  },

  /* ---------------------------------------------------------- prolongations */
  {
    id: 'tonika-sextakkord',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 0 }, { offset: 0, inversion: 1 }],
  },
  {
    // I – V6 – I6. The dominant is passed through rather than arrived at,
    // which is what "prolonging the tonic" means.
    id: 'tonika-prolongation',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 3,
    events: [{ offset: 0 }, { offset: 4, inversion: 1 }, { offset: 0, inversion: 1 }],
  },
  {
    // The **Durchgangsquartsextakkord**: a rising bass 1–2–3 under I – V6/4 – I6.
    // One of the three genuinely distinct six-four techniques.
    id: 'durchgangs-quartsext',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 0 }, { offset: 4, inversion: 2 }, { offset: 0, inversion: 1 }],
  },
  {
    // The **Wechselquartsextakkord**: the bass stands still while the upper
    // parts step away and back. Consonant, and no suspension anywhere.
    id: 'wechsel-quartsext',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 0 }, { offset: 3, inversion: 2 }, { offset: 0 }],
  },
  {
    id: 'dominant-prolongation',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 4 }, { offset: 4, seventh: true, inversion: 1 }],
  },
  {
    id: 'subdominant-prolongation',
    kind: 'prolongation',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 3 }, { offset: 1, inversion: 1 }],
  },

  /* ---------------------------------------------------------------- models */
  {
    // **Quintfallsequenz.** The unit is a pair whose roots fall a fifth, and
    // the origin steps down by one each link — which is what makes the chain
    // I IV vii° iii vi ii V I come out of two stored chords.
    id: 'quintfall',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 5,
    sequence: {
      unit: [
        { offset: 0, plain: true },
        { offset: 3, plain: true },
      ],
      step: -1,
      links: [2, 3],
    },
  },
  {
    id: 'quintfall-septakkorde',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 3,
    sequence: {
      unit: [
        { offset: 0, seventh: true, plain: true },
        { offset: 3, seventh: true, plain: true },
      ],
      step: -1,
      links: [2, 3],
    },
  },
  {
    id: 'quintanstieg',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 2,
    sequence: {
      unit: [
        { offset: 0, plain: true },
        { offset: 4, plain: true },
      ],
      step: 1,
      links: [2, 3],
    },
  },
  {
    // **Monte** — rising by step, each step tonicised.
    id: 'monte',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 3,
    sequence: {
      unit: [{ offset: 0, applied: 5, seventh: true }, { offset: 0 }],
      step: 1,
      links: [2],
    },
  },
  {
    // **Fonte** — the same unit falling, which is the pair Gjerdingen names.
    id: 'fonte',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 3,
    sequence: {
      unit: [{ offset: 0, applied: 5, seventh: true }, { offset: 0 }],
      step: -1,
      links: [2],
    },
  },
  {
    // **Fauxbourdon** — parallel six-chords over a stepwise bass.
    id: 'fauxbourdon',
    kind: 'model',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 2,
    sequence: {
      unit: [{ offset: 0, inversion: 1, plain: true }],
      step: -1,
      links: [3, 4],
    },
  },

  /* ------------------------------------------------------------- approaches */
  {
    id: 'zwischendominante',
    kind: 'approach',
    modes: BOTH,
    origins: TONICISABLE,
    weight: 4,
    events: [{ offset: 0, applied: 5, seventh: true }, { offset: 0 }],
  },
  {
    // **Doppeldominante** — the dominant of the dominant, which is the one
    // applied chord that has a name of its own in German theory.
    id: 'doppeldominante',
    kind: 'approach',
    modes: BOTH,
    origins: TONIC,
    weight: 3,
    events: [{ offset: 4, applied: 5, seventh: true }, { offset: 4 }],
  },
  {
    // **Neapolitaner** — ♭II, and always in first inversion, which is the only
    // form the convention writes. It names its own quality because an altered
    // root is not a diatonic stack and there is nothing to read it off.
    id: 'neapolitaner',
    kind: 'approach',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [
      { offset: 1, alteration: -1, quality: 'major', inversion: 1 },
      { offset: 4 },
    ],
  },

  /* --------------------------------------------------------------- cadences */
  {
    // **Vollkommener Ganzschluss** — V7 to I, both in root position, with the
    // tonic in the soprano. The soprano is the whole difference from the
    // imperfect one, which is why it is a constraint rather than a second block.
    id: 'ganzschluss-vollkommen',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 5,
    events: [
      { offset: 4, seventh: true },
      { offset: 0, soprano: 0, beats: 4 },
    ],
  },
  {
    id: 'ganzschluss-unvollkommen',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 4 }, { offset: 0, soprano: 2, beats: 4 }],
  },
  {
    // **Kadenz-Quartsextakkord**, which *is* the Quartsextvorhalt — one object
    // under two names. Modelled as what it is: a double suspension over a
    // dominant bass, 6–5 and 4–3 together, rather than as a second-inversion
    // tonic. That is what makes the figure and the voice leading fall out.
    id: 'kadenz-quartsext',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 4,
    events: [
      { offset: 4, suspend: [6, 4], beats: 4 },
      { offset: 0, soprano: 0, beats: 4 },
    ],
  },
  {
    id: 'halbschluss',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 3,
    events: [{ offset: 3 }, { offset: 4, beats: 4 }],
  },
  {
    // **Phrygischer Halbschluss** — iv6 to V, the cadence the minor mode has
    // and the major mode does not.
    id: 'phrygischer-halbschluss',
    kind: 'cadence',
    modes: MINOR,
    origins: TONIC,
    weight: 3,
    events: [
      { offset: 3, inversion: 1 },
      { offset: 4, beats: 4 },
    ],
  },
  {
    id: 'trugschluss',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 3,
    events: [
      { offset: 4, seventh: true },
      { offset: 5, beats: 4 },
    ],
  },
  {
    id: 'plagalschluss',
    kind: 'cadence',
    modes: BOTH,
    origins: TONIC,
    weight: 2,
    events: [{ offset: 3 }, { offset: 0, soprano: 0, beats: 4 }],
  },
]

export function getBlock(id: SatztechnikId): HarmonicBlock | undefined {
  return BLOCKS.find((block) => block.id === id)
}

export function blocksOfKind(kind: BlockKind): readonly HarmonicBlock[] {
  return BLOCKS.filter((block) => block.kind === kind)
}

export function isSatztechnikId(value: string): value is SatztechnikId {
  return value === 'frei' || BLOCKS.some((block) => block.id === value)
}

/* ------------------------------------------------------- what follows what */

/**
 * **What may stand before each degree**, and how readily.
 *
 * Backwards on purpose, and that is the point rather than a trick: *"what can
 * precede a dominant"* has a short, confident answer where *"what can follow a
 * tonic"* has a long, weak one. So the backwards table is smaller, better
 * motivated, and — because generation walks it from the cadence outward —
 * every progression arrives somewhere by construction rather than by luck.
 *
 * One table serves **both** jobs: it is the free walk's transition weights,
 * and it is also what decides whether one block may be prepended before
 * another. Two tables would be two things that could disagree about the same
 * question.
 */
const PRECEDENTS: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 5: 6, 4: 3, 7: 2, 6: 1, 3: 1, 2: 1 },
  2: { 1: 3, 6: 2, 4: 2, 3: 1 },
  3: { 1: 2, 6: 2, 4: 1, 5: 1 },
  4: { 1: 4, 5: 2, 6: 2, 2: 1, 3: 1 },
  5: { 4: 4, 2: 3, 1: 2, 6: 2, 7: 1, 3: 1 },
  6: { 5: 4, 1: 2, 3: 1, 4: 1 },
  7: { 1: 2, 4: 1, 6: 1, 2: 1 },
}

/** How readily `before` stands in front of `after`. Zero means never. */
export function precedence(before: number, after: number): number {
  return PRECEDENTS[after]?.[before] ?? 0
}

/** Every degree that may stand before this one, with its weight. */
export function precedentsOf(
  degree: number,
): readonly { degree: number; weight: number }[] {
  const row = PRECEDENTS[degree] ?? {}
  return Object.entries(row).map(([before, weight]) => ({
    degree: Number(before),
    weight,
  }))
}

/* ------------------------------------------------- turning a block into specs */

/** Degrees are cyclic: stepping past the seventh comes back to the first. */
export function wrapDegree(degree: number): number {
  return ((((degree - 1) % 7) + 7) % 7) + 1
}

const DEFAULT_BEATS = 2

function toSpec(origin: number, event: RelativeEvent): ChordSpec {
  const target = wrapDegree(origin + event.offset)
  const base = {
    inversion: event.inversion ?? 0,
    beats: event.beats ?? DEFAULT_BEATS,
    ...(event.seventh === true ? { seventh: true } : {}),
    ...(event.plain === true ? { plain: true } : {}),
    ...(event.suspend === undefined ? {} : { suspend: event.suspend }),
    ...(event.quality === undefined ? {} : { quality: event.quality }),
  }

  return event.applied === undefined
    ? {
        ...base,
        degree: target,
        ...(event.alteration === undefined ? {} : { alteration: event.alteration }),
      }
    : { ...base, degree: event.applied, of: target }
}

/** The degree a relative event actually sounds on — an applied chord's own root. */
export function eventDegree(origin: number, event: RelativeEvent): number {
  const target = wrapDegree(origin + event.offset)
  if (event.applied === undefined) return target
  // V/x stands a fifth above x, vii°/x a seventh — a walk inside the region.
  return wrapDegree(target + event.applied - 1)
}

export interface BlockChoice {
  block: HarmonicBlock
  origin: number
  /** How many links, for a sequence. */
  links: number
}

/** The relative events a choice spells out, sequence expanded. */
export function choiceEvents(
  choice: BlockChoice,
): readonly { origin: number; event: RelativeEvent }[] {
  const { block, origin, links } = choice

  if (block.sequence !== undefined) {
    const spelled: { origin: number; event: RelativeEvent }[] = []
    for (let link = 0; link < links; link += 1) {
      const at = wrapDegree(origin + link * block.sequence.step)
      for (const event of block.sequence.unit) spelled.push({ origin: at, event })
    }
    return spelled
  }

  return (block.events ?? []).map((event) => ({ origin, event }))
}

export function choiceSpecs(choice: BlockChoice): readonly ChordSpec[] {
  return choiceEvents(choice).map(({ origin, event }) => toSpec(origin, event))
}

/** The degree the block's first chord stands on. */
export function entryDegree(choice: BlockChoice): number | undefined {
  const first = choiceEvents(choice)[0]
  return first === undefined ? undefined : eventDegree(first.origin, first.event)
}

/** The degree the block's last chord stands on — what the next block follows. */
export function exitDegree(choice: BlockChoice): number | undefined {
  const events = choiceEvents(choice)
  const last = events[events.length - 1]
  return last === undefined ? undefined : eventDegree(last.origin, last.event)
}

export function exitClass(choice: BlockChoice): FunctionClass | undefined {
  const degree = exitDegree(choice)
  return degree === undefined ? undefined : degreeClass(degree)
}

/**
 * Whether a choice can actually be spelled in this key.
 *
 * **Computed by building it**, not by tabulating which blocks suit which
 * degrees — the move `isCleanScale` and `isCleanChord` both make. An applied
 * chord on a diminished degree has no region to be borrowed into, a sequence
 * can run off the end of what will spell, and both drop out here on their own.
 */
/**
 * Remembered, because the walk asks this of every candidate at every step and
 * the answer never changes.
 *
 * Spelling a block out runs `readChord` once per chord to name its quality,
 * which is nine qualities against every rotation of a stack — far too much to
 * repeat a few thousand times per progression. The key space is small and
 * fixed (the keys the app offers, times the blocks, times their origins), so
 * this is a table that fills once rather than a cache that needs managing.
 */
// Keyed on the block **object**, not its id: the two free variants share the
// id `frei` and differ only in inversion, so an id-keyed cache would hand one
// of them the other's answer.
const FITS = new WeakMap<HarmonicBlock, Map<string, boolean>>()

export function choiceFits(key: Key, choice: BlockChoice): boolean {
  let rows = FITS.get(choice.block)
  if (rows === undefined) {
    rows = new Map<string, boolean>()
    FITS.set(choice.block, rows)
  }

  const row = `${keyKey(key)}|${choice.origin}|${choice.links}`
  const cached = rows.get(row)
  if (cached !== undefined) return cached

  const specs = choiceSpecs(choice)
  const fits =
    choice.block.modes.includes(key.mode) &&
    specs.length > 0 &&
    specs.every((spec) => buildEvents(key, spec) !== undefined)

  rows.set(row, fits)
  return fits
}

/** Every way a block can be placed, for a generator to weigh up. */
export function choicesOf(block: HarmonicBlock): readonly BlockChoice[] {
  const links = block.sequence?.links ?? [1]
  return block.origins.flatMap((origin) =>
    links.map((count) => ({ block, origin, links: count })),
  )
}

/**
 * How many **events** a choice contributes.
 *
 * Not how many chords it names: a suspension is one chord of the plan and two
 * sonorities on the page, and counting the plan would let a progression with a
 * cadential six-four in it come out one longer than the level asked for. It is
 * readable off `suspend` alone, so no key is needed to know it.
 */
export function choiceLength(choice: BlockChoice): number {
  return choiceEvents(choice).reduce(
    (total, { event }) =>
      total + (event.suspend === undefined || event.suspend.length === 0 ? 1 : 2),
    0,
  )
}

/**
 * The free walk, as blocks of length one.
 *
 * **A single chord is a block**, which is what lets one algorithm cover both
 * the named Satzmodelle and a plain chord-by-chord walk: the walk is simply
 * what happens when the blocks it reaches for are these. Their transitions
 * come from `PRECEDENTS`, the same table that decides whether any other two
 * blocks may stand next to each other, so a free stretch is no less
 * well-formed than a schema — it just has no name, and the annotation says
 * `frei` rather than pretending otherwise.
 *
 * They are kept out of `BLOCKS` because they are not vocabulary a level
 * chooses; how much of a progression is free is a weight rather than a list.
 */
export const FREE_BLOCKS: readonly HarmonicBlock[] = [
  {
    id: 'frei',
    kind: 'free',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 3,
    events: [{ offset: 0 }],
  },
  {
    id: 'frei',
    kind: 'free',
    modes: BOTH,
    origins: ANY_DEGREE,
    weight: 1,
    events: [{ offset: 0, inversion: 1 }],
  },
]
