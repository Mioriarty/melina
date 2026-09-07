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
  scale: 126,
}

let toolkit: Promise<VerovioToolkit> | undefined

function load(): Promise<VerovioToolkit> {
  return (async () => {
    const [{ default: createVerovioModule }, { VerovioToolkit: Toolkit }] =
      await Promise.all([import('verovio/wasm'), import('verovio/esm')])

    const module = await createVerovioModule()
    const instance = new Toolkit(module)
    instance.setOptions(OPTIONS)
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

/** Engrave a MEI document and return it as an SVG string. */
export async function renderMei(mei: string): Promise<string> {
  const instance = await getEngraver()

  if (!instance.loadData(mei)) {
    throw new EngravingError('Verovio could not parse the generated MEI')
  }

  return instance.renderToSVG(1)
}
