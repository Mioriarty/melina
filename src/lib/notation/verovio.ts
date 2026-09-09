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
 */
export const DEFAULT_STAFF_SIZE = 126

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
const RHYTHM_PROFILES = new Map<string, VerovioOptions>()

export function rhythmProfile(beats: number, staves: 1 | 2): VerovioOptions {
  const key = `${beats}:${staves}`
  const cached = RHYTHM_PROFILES.get(key)
  if (cached !== undefined) return cached

  const profile: VerovioOptions = {
    breaks: 'auto',
    adjustPageWidth: false,
    adjustPageHeight: false,
    pageWidth: RHYTHM_PAGE_LEAD + RHYTHM_PAGE_PER_BEAT * beats,
    pageHeight: staves === 2 ? RHYTHM_TWO_STAFF_HEIGHT : RHYTHM_PAGE_HEIGHT,
  }
  RHYTHM_PROFILES.set(key, profile)
  return profile
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
