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
