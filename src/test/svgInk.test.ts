import { describe, expect, it } from 'vitest'

import { measureInk, pathBox } from './svgInk'

/**
 * The measuring stick, measured.
 *
 * Worth its own test because getting it wrong is silent: a check that says
 * "plenty of room" when it cannot see half the drawing passes just as happily
 * as a correct one. Both mistakes below were made for real — reading a glyph's
 * anchor as though it were its ink, and forgetting that everything sits inside
 * a group carrying the page margins.
 */

/** A drawing shaped like Verovio's: outlines in defs, placed by `<use>`. */
function drawing({
  glyph = 'M0 -100 L200 -100 L200 100 L0 100 Z',
  at = [500, 500] as [number, number],
  scale = 1,
  margin = [60, 60] as [number, number],
  page = [1300, 2050] as [number, number],
  strokes = '<path d="M0 540 L1180 540" stroke-width="13" />',
} = {}): string {
  return (
    `<svg width="143px" height="215px">` +
    `<defs><g id="E0A4-x"><path transform="scale(1,-1)" d="${glyph}" /></g></defs>` +
    `<svg class="definition-scale" viewBox="0 0 ${page[0]} ${page[1]}">` +
    `<g class="page-margin" transform="translate(${margin[0]}, ${margin[1]})">` +
    strokes +
    `<use href="#E0A4-x" transform="translate(${at[0]}, ${at[1]}) scale(${scale}, ${scale})" />` +
    `</g></svg></svg>`
  )
}

describe('pathBox', () => {
  it('spans the points a path visits', () => {
    expect(pathBox('M10 20 L30 40')).toEqual({ x0: 10, x1: 30, y0: 20, y1: 40 })
  })

  it('follows relative commands from where it already is', () => {
    expect(pathBox('M10 10 l10 10 l-5 -20')).toEqual({ x0: 10, x1: 20, y0: 0, y1: 20 })
  })

  it('handles the shorthands', () => {
    expect(pathBox('M10 10 H50 V60')).toEqual({ x0: 10, x1: 50, y0: 10, y1: 60 })
  })

  it('keeps a curve inside its control points, which is the safe direction', () => {
    // A Bézier never leaves its control hull, so counting the controls can
    // only overstate — and this answer is used to prove something *fits*.
    const box = pathBox('M0 0 C0 -200 100 -200 100 0')
    expect(box?.y0).toBe(-200)
    expect(box?.x1).toBe(100)
  })

  it('is undefined for a path with nothing in it', () => {
    expect(pathBox('')).toBeUndefined()
  })
})

describe('measureInk', () => {
  it('reads the page from the viewBox', () => {
    const { page } = measureInk(drawing())
    expect(page).toEqual({ x0: 0, y0: 0, x1: 1300, y1: 2050 })
  })

  it('resolves a glyph to its outline, not to its anchor', () => {
    // The mistake that let a notehead be sliced in half: the anchor sat well
    // inside the page while the ink hung 100 units below it.
    const { ink } = measureInk(drawing({ at: [500, 1900] }))
    expect(ink.y1).toBe(1900 + 100 + 60)
  })

  it('counts the group that carries the page margins', () => {
    // Without it a staff line, which really does begin at x = 0 of its own
    // group, looks as though it were touching the edge of the paper.
    expect(measureInk(drawing({ margin: [60, 60] })).ink.x0).toBe(0 + 60)
    expect(measureInk(drawing({ margin: [0, 0] })).ink.x0).toBe(0)
  })

  it('scales a glyph by the transform that places it', () => {
    const full = measureInk(drawing({ at: [500, 500], scale: 1 })).ink
    const half = measureInk(drawing({ at: [500, 500], scale: 0.5 })).ink
    expect(half.y1 - 560).toBe((full.y1 - 560) / 2)
  })

  it('counts half a stroke, since a stroke straddles its own path', () => {
    const { ink } = measureInk(
      drawing({ strokes: '<path d="M0 540 L1180 540" stroke-width="40" />' }),
    )
    // 540 + 60 of margin, less half the 40-unit stroke.
    expect(ink.y0).toBeLessThanOrEqual(540 + 60 - 20)
  })

  it('reports the smallest gap to any edge', () => {
    const near = measureInk(drawing({ at: [500, 1880] }))
    expect(near.clearance).toBe(2050 - (1880 + 100 + 60))
  })

  it('goes negative when something runs off the page', () => {
    // What the guard is for: the answer has to be a number that can fail, not
    // a clamp that quietly reads zero.
    expect(measureInk(drawing({ at: [500, 2000] })).clearance).toBeLessThan(0)
  })

  it('refuses a drawing it cannot measure rather than saying it is roomy', () => {
    expect(() => measureInk('<svg><g/></svg>')).toThrow(/viewBox/)
    expect(() =>
      measureInk('<svg><svg viewBox="0 0 10 10"><g class="page-margin"/></svg></svg>'),
    ).toThrow(/nothing was drawn/)
  })
})
