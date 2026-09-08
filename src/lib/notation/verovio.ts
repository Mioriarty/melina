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
 * | value | staff height | look                                  |
 * | ----- | ------------ | ------------------------------------- |
 * | 0.25  | 104px        | the default, and too tight for a scale |
 * | 0.35  | 78px         | a little air                           |
 * | 0.45  | 62px         | what ships                            |
 * | 0.50  | 57px         | very airy, notes getting small         |
 */
export const SCALE_NOTE_SPACING = 0.30

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
 * Spacing is applied per render rather than once at startup, because one
 * toolkit is shared by the whole app and a scale wants more room between its
 * notes than an interval does. Options are toolkit-wide, so they are set
 * immediately before the render they belong to: everything from here to
 * `renderToSVG` is synchronous, so no other render can interleave and pick up
 * the wrong spacing.
 */
export async function renderMei(
  mei: string,
  noteSpacing: number = DEFAULT_NOTE_SPACING,
): Promise<string> {
  const instance = await getEngraver()
  instance.setOptions({
    ...OPTIONS,
    scale: DEFAULT_STAFF_SIZE,
    spacingLinear: noteSpacing,
  })

  if (!instance.loadData(mei)) {
    throw new EngravingError('Verovio could not parse the generated MEI')
  }

  return instance.renderToSVG(1)
}
