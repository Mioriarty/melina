/**
 * Hand-written declarations for the verovio npm package, which ships none.
 *
 * Deliberately minimal: only the members melina calls are declared, so an
 * upstream API change surfaces as a type error here rather than silently.
 */

declare module 'verovio/wasm' {
  /** Opaque Emscripten module handle. */
  export interface VerovioModule {
    readonly __verovio: unique symbol
  }
  const createVerovioModule: () => Promise<VerovioModule>
  export default createVerovioModule
}

declare module 'verovio/esm' {
  import type { VerovioModule } from 'verovio/wasm'

  export interface VerovioOptions {
    font?: string
    scale?: number
    adjustPageHeight?: boolean
    adjustPageWidth?: boolean
    breaks?: 'none' | 'auto' | 'line' | 'smart' | 'encoded'
    header?: 'none' | 'auto' | 'encoded'
    footer?: 'none' | 'auto' | 'encoded'
    pageMarginTop?: number
    pageMarginBottom?: number
    pageMarginLeft?: number
    pageMarginRight?: number
    svgViewBox?: boolean
    svgHtml5?: boolean
    svgRemoveXlink?: boolean
    spacingStaff?: number
    /**
     * Where the font comes from for a SMuFL glyph that Verovio emits as *text*
     * rather than as a `<use>` — which today means the accidentals inside a
     * figured bass. `embedded` inlines the font as an `@font-face` in the SVG;
     * the other two emit `font-family="Leipzig"` with nothing to resolve it
     * with, so the sign renders as a blank. Declared rather than left to the
     * index signature below because it is load-bearing: see
     * `thoroughbassProfile`.
     */
    smuflTextFont?: 'embedded' | 'linked' | 'none'
    [option: string]: unknown
  }

  export class VerovioToolkit {
    constructor(module: VerovioModule)
    setOptions(options: VerovioOptions): void
    loadData(data: string): boolean
    renderToSVG(page?: number, options?: VerovioOptions): string
    getPageCount(): number
    getVersion(): string
  }
}
