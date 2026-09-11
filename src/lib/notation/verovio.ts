import type { VerovioToolkit, VerovioOptions } from 'verovio/esm'

/**
 * The Verovio engraver, loaded on demand.
 *
 * The module is ~7 MB of WebAssembly embedded in JavaScript, so it must never
 * reach the main bundle: it is pulled in by dynamic `import()` from a lazy
 * route, kept out of the service worker precache, and cached at runtime after
 * first use instead. See vite.config.ts.
 *
 * One toolkit is shared by the whole app. Instantiating it is expensive and
 * it is stateful only between `loadData` and `renderToSVG`, which `render`
 * below keeps as a single synchronous step.
 */

const OPTIONS: VerovioOptions = {
  // Leland is the MuseScore font, and ships inside the wasm — there is no
  // resource path to configure, and `setResourcePath` is a no-op on the web.
  font: 'Leland',
  // Shrink the page to the engraved content rather than an A4 sheet.
  adjustPageHeight: true,
  adjustPageWidth: true,
  breaks: 'none',
  header: 'none',
  footer: 'none',
  pageMarginTop: 12,
  pageMarginBottom: 12,
  pageMarginLeft: 12,
  pageMarginRight: 12,
  // Emit real pixel dimensions rather than a bare viewBox. With only a
  // viewBox the SVG has no intrinsic size, so any CSS width stretches every
  // example to the same box — and a seven-sharp key signature, which is
  // genuinely wider, would render its notes far smaller than a plain one.
  // Intrinsic sizing keeps the staff the same size everywhere and lets the
  // box grow with the content, which is how notation is supposed to behave.
  svgViewBox: false,
  svgRemoveXlink: true,
  spacingNonLinear: 0.6,
}

/* --------------------------------------------------------- how it is sized

   Two dials, and it is worth knowing which one does what, because the page
   only ever scales an engraved SVG *down* to fit its column.

   A staff wider than the column is therefore fitted to exactly that width,
   whatever size it was drawn at — so for anything that overflows, the staff
   size changes nothing you can see and the *shape* of the render decides
   everything: eight notes always span the column, and what varies is how big
   the notes are within it.

   That makes NOTE SPACING the dial for how airy notation looks, and staff
   size only the dial for something small enough not to overflow. */

/**
 * How big the staff is drawn, as a percentage of Verovio's own default.
 * An interval is two notes wide and never overflows, so this is what sets
 * its size on screen.
 *
 * **This is the interval dial, and only the interval dial.** A scale is 971px
 * of engraved width against a 624px column at its widest, so it is fitted to
 * the column at every supported size and this number cannot move it — which is
 * what makes it safe to turn without touching how a scale reads. A rhythm is
 * fitted the same way in every metre but 2/4.
 *
 * It came down from 126, and then from 110, because the interval was the one
 * example drawn larger than the column would ever have forced: at 126 a
 * two-note staff stood 258px tall on a desktop while a scale beside it stood
 * 166px and a bar of rhythm 113px, so the notation looked overbearing in the
 * exercise that shows the least of it. At 95 it is around 195px — still
 * comfortably the largest thing on the screen, and still the centre of the
 * app, without crowding the prompt above it and the answer below.
 *
 * Height is capped a second time by the room actually left on the screen —
 * see `SCORE_BOX`. That is what stops the notation running into the Next
 * button; this number is what decides how big it is when there *is* room.
 */
export const DEFAULT_STAFF_SIZE = 95

/**
 * How much horizontal room each note is given. Verovio's own default.
 *
 * Steeper than it looks: 0.6 is already four times as wide as 0.25, and the
 * engraver refuses anything above 1.0.
 */
export const DEFAULT_NOTE_SPACING = 0.25

/**
 * **Note spacing for a scale — the dial to turn if it looks cramped.**
 *
 * Eight notes at the default spanned the column with barely a notehead's
 * width between them. Widening the spacing makes the whole render wider,
 * which the column then fits to — so the notes end up further apart and the
 * staff smaller, in the same space as before.
 *
 * On a 375px phone, where the notation gets a 343px column:
 *
 * | value | staff height | look                                   |
 * | ----- | ------------ | -------------------------------------- |
 * | 0.25  | 104px        | the default, and too tight for a scale  |
 * | 0.30  | 89px         | what ships                             |
 * | 0.35  | 78px         | more air                               |
 * | 0.45  | 62px         | airy                                   |
 * | 0.50  | 57px         | very airy, notes getting small          |
 *
 * Nothing asserts the exact value — it is meant to be turned. The tests only
 * check that a scale still gets more room than the default and still fills
 * its column.
 */
export const SCALE_NOTE_SPACING = 0.3

/**
 * **How a rhythm is rendered, and why it is not rendered like everything else.**
 *
 * Every other example is engraved to the width of its own content and then
 * scaled down to fit the column. That is exactly wrong for a bar being typed
 * into: each keystroke makes the content wider, the column scales it down
 * harder, and the staff shrinks under the player's hands.
 *
 * A fixed page fixes the box instead — the SVG comes out the same size whatever
 * is in it, so the scale to the column never changes and a note already placed
 * never moves. Three things make that work:
 *
 * - `breaks: 'auto'` is what makes Verovio honour the width at all; under
 *   `breaks: 'none'` it shrinks the page to the content and ignores it.
 * - The height is pinned for the same reason as the width: left to itself it
 *   grew the moment a beam appeared, which changed the scale to the column.
 * - `rhythmMei` pads the unentered end of the bar with `<space>`, so the
 *   measure keeps its full duration and the notes already placed keep their
 *   exact positions.
 *
 * **The width is per metre, not one number for everything.** It has to hold the
 * densest bar the keyboard can produce — every sixteenth of every beat — since
 * that is what a player might type whatever the question was. Sizing it for the
 * worst case in 5/4 and then using that in 2/4 would draw every 2/4 bar in the
 * left third of a box twice as wide as it needs, and on a phone the staff would
 * come out half the size it should be.
 *
 * Note spacing is left at Verovio's default: widening it stretches the densest
 * bar just as much as the sparsest, so the page has to grow to match and the
 * staff ends up smaller for no gain. Measured, 0.25 is the best of them.
 *
 * **The bar is stretched to fill the page** — see `FILL_THE_PAGE`. A page has
 * to hold sixteen sixteenths, so a bar of four quarters left to its natural
 * width sat in the left 44% of the staff with the rest of it empty.
 */
const RHYTHM_PAGE_LEAD = 160
const RHYTHM_PAGE_PER_BEAT = 140
/** One staff, and the taller page a second one underneath it needs. */
const RHYTHM_PAGE_HEIGHT = 130
const RHYTHM_TWO_STAFF_HEIGHT = 240

/**
 * Cached, because `Score` compares the profile by identity to decide whether a
 * finished render still belongs to the render it asked for — a fresh object
 * every time would re-render on every paint.
 */
/**
 * **Stretch a lone system to the width of its page.**
 *
 * Verovio justifies a system to the page, but leaves the *last* one alone when
 * it comes out shorter than `minLastJustification` of the page — sensible for
 * the final line of a piece, and wrong for every example here, where the only
 * system there is *is* the last one. Left at the default it fell short of the
 * 80% mark and was drawn at its natural width, hard against the left edge,
 * with the rest of the staff empty.
 *
 * The page cannot simply be made narrower: it is sized for the widest answer
 * that could be typed into it — sixteen sixteenths, or a melody under seven
 * accidentals — and that reserve is the whole reason a note already placed
 * does not move. So the page stays, and the music is spread across it.
 *
 * For a melody this costs nothing at all: the measure holds one event per
 * slot whatever has been written, `<space>` for the rest, so the notes land on
 * exactly the same x at every stage of typing. A rhythm has no such fixed
 * count — four sixteenths can replace one quarter — so there the notes do
 * shift as the bar fills, which is the price of not having them huddled in
 * one corner of a staff sized for the worst case.
 */
const FILL_THE_PAGE = { minLastJustification: 0 } as const

const RHYTHM_PROFILES = new Map<string, VerovioOptions>()

export function rhythmProfile(beats: number, staves: 1 | 2): VerovioOptions {
  const key = `${beats}:${staves}`
  const cached = RHYTHM_PROFILES.get(key)
  if (cached !== undefined) return cached

  const profile: VerovioOptions = {
    ...FILL_THE_PAGE,
    breaks: 'auto',
    adjustPageWidth: false,
    adjustPageHeight: false,
    pageWidth: RHYTHM_PAGE_LEAD + RHYTHM_PAGE_PER_BEAT * beats,
    pageHeight: staves === 2 ? RHYTHM_TWO_STAFF_HEIGHT : RHYTHM_PAGE_HEIGHT,
  }
  RHYTHM_PROFILES.set(key, profile)
  return profile
}

/**
 * **How a melody being written down is rendered.**
 *
 * The same problem the rhythm profile solves, and the same answer: a fixed page
 * so the box, the staff size and the notes already placed cannot move while the
 * answer is being typed. `melodyMei` supplies the other half by padding the
 * unwritten tail with `<space>`, which keeps the measure its full length.
 *
 * The width is per **slot count**, because that is what the finished answer
 * will be as wide as. Measured against the worst case there is — the longest
 * melody, under seven accidentals, with every note carrying one of its own —
 * so a page is never overrun by a key signature nobody thought about.
 *
 * That reserve is much wider than a plain key needs, which is why the system is
 * stretched to fill it — see `FILL_THE_PAGE`. Here it is free: the measure
 * holds one event per slot from the first keypress, so every note keeps the
 * same x throughout.
 */
const MELODY_PAGE_LEAD = 250
const MELODY_PAGE_PER_SLOT = 62
/** A second staff underneath needs room for itself and for both labels. */
const MELODY_TWO_STAFF_LEAD = 390
/**
 * Tall enough for the deepest thing a melody can reach: a degree two ledger
 * lines below the staff — A3 in the treble, which A minor and A major both
 * reach. Sized by rasterising the extremes and demanding clear space around
 * them, because measuring a glyph's *anchor* says nothing about how far its
 * ink spreads from there, and reading anchors is exactly how an earlier
 * version came to cut the noteheads in half.
 */
const MELODY_PAGE_HEIGHT = 235
const MELODY_TWO_STAFF_HEIGHT = 410

/**
 * Cached for the same reason `rhythmProfile` is: `Score` compares the profile
 * by identity, so a fresh object would re-render on every paint.
 */
const MELODY_PROFILES = new Map<string, VerovioOptions>()

export function melodyProfile(slots: number, staves: 1 | 2): VerovioOptions {
  const key = `${slots}:${staves}`
  const cached = MELODY_PROFILES.get(key)
  if (cached !== undefined) return cached

  const lead = staves === 2 ? MELODY_TWO_STAFF_LEAD : MELODY_PAGE_LEAD
  const profile: VerovioOptions = {
    ...FILL_THE_PAGE,
    breaks: 'auto',
    adjustPageWidth: false,
    adjustPageHeight: false,
    pageWidth: lead + MELODY_PAGE_PER_SLOT * slots,
    pageHeight: staves === 2 ? MELODY_TWO_STAFF_HEIGHT : MELODY_PAGE_HEIGHT,
  }
  MELODY_PROFILES.set(key, profile)
  return profile
}

/**
 * **How a melody being written down over several bars is rendered.**
 *
 * The same fixed page as the rhythm and melody profiles above, with one thing
 * they did not need: **where the systems break.**
 *
 * A phrase of two bars laid out by the engraver's own judgement sits on one
 * system while it is short and jumps to two the moment a bar fills, which
 * halves the staff under the player's hands — the exact failure the fixed page
 * exists to prevent, arriving by a different door. So `melodicPhraseMei` writes
 * an `<sb/>` where each system ends and this asks for `breaks: 'encoded'`,
 * which uses those and only those. The number of systems is then a property of
 * the question rather than of how much has been typed.
 *
 * A single system is the exception, and only because there is nothing to
 * honour: one bar carries no `<sb/>`, and Verovio warns on every render when
 * asked to lay out by encoded breaks it cannot find.
 *
 * **The width reserves one system's worth of the worst case** — every beat of
 * every bar on that system divided into sixteenths, each with an accidental in
 * front of it, since that is what a player might type whatever the question
 * was. Reserving the whole phrase on one line instead is what makes multi-bar
 * unreadable: two bars of that side by side come out around 1300px, which a
 * 375px phone scales to a staff of some 35px.
 *
 * The height follows the system count, and both are pinned, so the box the
 * notation is drawn in never changes size while the answer grows.
 */
const MELODIC_PAGE_LEAD = 380
/** A second staff underneath needs room for both labels. */
const MELODIC_TWO_STAFF_LEAD = 540
const MELODIC_PAGE_PER_BEAT = 165
/**
 * One system's height, measured rather than reasoned: a melody may reach two
 * ledger lines either side of the staff, and a beamed group of sixteenths adds
 * its stems on top of that.
 */
const MELODIC_SYSTEM_HEIGHT = 330
const MELODIC_TWO_STAFF_SYSTEM_HEIGHT = 580

const MELODIC_PROFILES = new Map<string, VerovioOptions>()

export function melodicPhraseProfile(
  beats: number,
  bars: number,
  barsPerSystem: number,
  staves: 1 | 2,
): VerovioOptions {
  const key = `${beats}:${bars}:${barsPerSystem}:${staves}`
  const cached = MELODIC_PROFILES.get(key)
  if (cached !== undefined) return cached

  const systems = Math.max(1, Math.ceil(bars / barsPerSystem))
  const perSystem = staves === 2 ? MELODIC_TWO_STAFF_SYSTEM_HEIGHT : MELODIC_SYSTEM_HEIGHT
  const lead = staves === 2 ? MELODIC_TWO_STAFF_LEAD : MELODIC_PAGE_LEAD

  const profile: VerovioOptions = {
    ...FILL_THE_PAGE,
    // `encoded` only when there is something encoded to honour. A phrase of
    // one system carries no `<sb/>` at all, and asking Verovio to lay out by
    // breaks that are not there warns on every render — one bar cannot be
    // broken anyway, and the page is sized so it never needs to be.
    breaks: systems > 1 ? 'encoded' : 'auto',
    adjustPageWidth: false,
    adjustPageHeight: false,
    pageWidth: lead + MELODIC_PAGE_PER_BEAT * beats * Math.min(bars, barsPerSystem),
    pageHeight: systems * perSystem,
  }
  MELODIC_PROFILES.set(key, profile)
  return profile
}

/**
 * **How a figured bass is rendered.**
 *
 * The same fixed page as the two dictation profiles, for the same reason: the
 * figure is typed under the staff in one exercise and the chord onto it in the
 * other, so the box and the staff size must not move while an answer is being
 * written.
 *
 * The reserve is what a player might still write rather than what the question
 * asked — **three figure lines, each carrying an accidental**, which is both
 * taller and wider than the plain `6` most questions want. Reserving that means
 * a bare `6` is drawn in a page with room for two more lines, which is exactly
 * the point.
 *
 * Width grows with the key signature, drawn once at the head of the system, and
 * with the number of **chords**, not of bass notes. A suspension is two chords
 * under one held bass, and sized for one of them the measure came out so tight
 * that the first chord was drawn over the clef.
 *
 * **These are page units, which are a tenth of the viewBox units a render
 * reports.** Reading a natural size off the viewBox and feeding it back in as
 * `pageWidth` makes a page ten times too big: the music is then drawn in one
 * corner of it, the column scales the whole sheet down to fit, and the staff
 * comes out a tenth of the size it should be. That is not a subtle wrongness on
 * the page — it is illegible — and nothing that compares one render against
 * another can see it, because every render is equally wrong. Hence
 * `thoroughbassVerovio.test.ts` measuring the size against the staff the app
 * actually gets, and not only against itself.
 */
/**
 * **Room on the left for the brace.**
 *
 * A `<grpSym>` brace is drawn *outside* the system it joins — at x = -432 in a
 * render's own units, against a page margin of 12 (which is 120 of those
 * units), so with the app's usual margin it lands at -312 and the inner `<svg>`
 * clips it away. What survives is three short strokes at the very left edge,
 * which reads as a rendering fault rather than as a brace.
 *
 * No other example in the app has anything drawn outside its system, which is
 * why this is the only profile that moves the margin. The width below carries
 * the same amount again, so widening the margin does not narrow the music.
 */
const THOROUGHBASS_MARGIN_LEFT = 50

const THOROUGHBASS_PAGE_LEAD = 170
const THOROUGHBASS_PER_ACCIDENTAL = 24
const THOROUGHBASS_PER_EVENT = 177
const THOROUGHBASS_PAGE_HEIGHT = 448

/**
 * **Verovio draws an accidental inside a figure as a character, not a glyph.**
 *
 * `<f>♯6</f>` comes out as `<tspan font-family="Leipzig">U+EA66</tspan>` — the
 * SMuFL *figured-bass* sharp, which is the right character, in a font the
 * browser does not have. Only `embedded` inlines that font into the SVG;
 * `linked` and `none` emit the same `font-family` and nothing to resolve it
 * with, so the sign renders as a blank.
 *
 * It is not free and it is worth knowing exactly what it costs, because the
 * number is surprising: a render with no figures is 6.2 KB and one with plain
 * digits 6.7 KB, but **the first accidental takes it to 65 KB** — the whole
 * text font, not a subset (one accidental and three cost the same). So the
 * price is paid per render, and only by a figure that carries an accidental.
 *
 * The fix, when it is worth doing, is the one `npm run glyphs` already uses for
 * Leland: lift the font out of Verovio once at build time, self-host it, and
 * switch this to `linked` — 58 KB cached once instead of per render.
 */
const EMBED_FIGURE_ACCIDENTALS = { smuflTextFont: 'embedded' } as const

/**
 * A figured bass drawn as an **example** rather than as a question.
 *
 * The fixed page below exists so a staff cannot move while an answer is typed
 * into it. Nothing is typed into an example, so there is nothing to reserve and
 * the page shrinks to the music instead — which on an explainer page is the
 * difference between a row of staves and a row of staves each sitting in a
 * third of a box.
 *
 * The brace still needs its margin and an accidental in a figure still needs
 * its font. One shared object, because `Score` compares a profile by identity.
 */
export const THOROUGHBASS_EXAMPLE_PROFILE: VerovioOptions = {
  ...EMBED_FIGURE_ACCIDENTALS,
  breaks: 'auto',
  adjustPageWidth: true,
  adjustPageHeight: true,
  pageMarginLeft: THOROUGHBASS_MARGIN_LEFT,
}

const THOROUGHBASS_PROFILES = new Map<string, VerovioOptions>()

export function thoroughbassProfile(
  slots: number,
  signatureAccidentals: number,
): VerovioOptions {
  const key = `${slots}:${signatureAccidentals}`
  const cached = THOROUGHBASS_PROFILES.get(key)
  if (cached !== undefined) return cached

  const profile: VerovioOptions = {
    ...FILL_THE_PAGE,
    ...EMBED_FIGURE_ACCIDENTALS,
    breaks: 'auto',
    adjustPageWidth: false,
    adjustPageHeight: false,
    pageMarginLeft: THOROUGHBASS_MARGIN_LEFT,
    pageWidth:
      THOROUGHBASS_PAGE_LEAD +
      THOROUGHBASS_PER_ACCIDENTAL * signatureAccidentals +
      THOROUGHBASS_PER_EVENT * Math.max(1, slots),
    pageHeight: THOROUGHBASS_PAGE_HEIGHT,
  }
  THOROUGHBASS_PROFILES.set(key, profile)
  return profile
}

/**
 * **A chord being written into, on a page that cannot move.**
 *
 * The same reserve a rhythm and a melody get, for the same reason: the column
 * scales an engraved SVG down to fit, so a render that grows as the answer is
 * typed shrinks the staff under the player's hands. A chord grows sideways
 * every time a note arrives carrying an accidental — the widest chord in the
 * vocabulary engraves 41% wider than an empty bar — and downwards every time
 * one needs a ledger line.
 *
 * Measured rather than guessed, across every quality, root, inversion and Lage
 * on all four clefs: the widest is 3620 viewBox units and the tallest 2450, and
 * `pageWidth`/`pageHeight` are **a tenth of those** — feeding the viewBox units
 * straight back in makes a page ten times too big, draws the music in one
 * corner and scales the staff to a tenth of its size. Nothing that compares one
 * render against another can see that, because every render is equally wrong,
 * which is why `chordVerovio.test.ts` checks this against a bar of rhythm.
 *
 * `FILL_THE_PAGE` because a chord is one event and has nothing to spread:
 * unjustified, its staff lines stop at the notehead and a short staff floats in
 * a wide box, which reads as a fault rather than as a reserve.
 *
 * Reading and hearing need none of this. Nothing is typed into them, and a
 * hidden chord is *engraved* rather than left out, so the render is the same
 * size asked and revealed — which is the whole reason `@visible` is used there.
 */
const CHORD_PAGE_WIDTH = 362
const CHORD_PAGE_HEIGHT = 245

export const CHORD_ANSWER_PROFILE: VerovioOptions = {
  ...FILL_THE_PAGE,
  breaks: 'auto',
  adjustPageWidth: false,
  adjustPageHeight: false,
  pageWidth: CHORD_PAGE_WIDTH,
  pageHeight: CHORD_PAGE_HEIGHT,
}

/**
 * One note on a bare staff, for a key on the degree keyboard.
 *
 * Fixed so that seven keys standing in a row are the same size and their staves
 * line up. Left to itself the page shrinks to its content, and a key whose note
 * prints an accidental or needs a ledger line would come out larger than the
 * one beside it. Sized for the widest and tallest of them, measured across
 * every clef, key and degree the exercise can offer.
 */
export const DEGREE_KEY_PROFILE: VerovioOptions = {
  breaks: 'auto',
  adjustPageWidth: false,
  adjustPageHeight: false,
  // Measured across every clef, key and degree the exercise can offer, by
  // rasterising the extremes and demanding clear space on every side. A
  // degree can sit two ledger lines below the staff — A3 in the treble — and
  // those reach further down than any stem does, so they are what sets the
  // height. The margins are still tight: the page defaults leave a third of a
  // key empty, and on something this small that is a third of the note.
  pageWidth: 130,
  pageHeight: 205,
  pageMarginTop: 6,
  pageMarginBottom: 6,
  pageMarginLeft: 6,
  pageMarginRight: 6,
}

let toolkit: Promise<VerovioToolkit> | undefined

function load(): Promise<VerovioToolkit> {
  return (async () => {
    const [{ default: createVerovioModule }, { VerovioToolkit: Toolkit }] =
      await Promise.all([import('verovio/wasm'), import('verovio/esm')])

    const module = await createVerovioModule()
    const instance = new Toolkit(module)
    // Set again per render, since the spacing varies by exercise.
    instance.setOptions({ ...OPTIONS, scale: DEFAULT_STAFF_SIZE })
    return instance
  })()
}

/**
 * Start fetching Verovio without waiting for it. Called when an exercise that
 * will need notation mounts, so the download overlaps with the user reading
 * the setup screen instead of stalling the first question.
 */
export function preloadEngraver(): void {
  toolkit ??= load()
}

export function getEngraver(): Promise<VerovioToolkit> {
  toolkit ??= load()
  return toolkit
}

export class EngravingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngravingError'
  }
}

/**
 * Engrave a MEI document and return it as an SVG string.
 *
 * Spacing and the page profile are applied per render rather than once at
 * startup, because one toolkit is shared by the whole app: a scale wants more
 * room between its notes than an interval does, and a rhythm wants a fixed page
 * rather than one shrunk to its content. Options are toolkit-wide, so they are
 * set immediately before the render they belong to: everything from here to
 * `renderToSVG` is synchronous, so no other render can interleave and pick up
 * the wrong ones.
 */
export async function renderMei(
  mei: string,
  noteSpacing: number = DEFAULT_NOTE_SPACING,
  profile: VerovioOptions = {},
): Promise<string> {
  const instance = await getEngraver()
  instance.setOptions({
    ...OPTIONS,
    scale: DEFAULT_STAFF_SIZE,
    spacingLinear: noteSpacing,
    ...profile,
  })

  if (!instance.loadData(mei)) {
    throw new EngravingError('Verovio could not parse the generated MEI')
  }

  return instance.renderToSVG(1)
}
