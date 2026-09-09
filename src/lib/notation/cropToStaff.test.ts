import { describe, expect, it } from 'vitest'

import { cropToStaff } from './cropToStaff'

/** A stand-in for what Verovio returns: a viewBox, staff lines, and a note. */
function drawing({
  width = 1300,
  height = 1700,
  lines = [60, 240, 420, 600, 780],
  from = 60,
  to = 870,
}: {
  width?: number
  height?: number
  lines?: readonly number[]
  from?: number
  to?: number
} = {}): string {
  const staff = lines.map((y) => `<path d="M${from} ${y} L${to} ${y}" />`).join('')
  return (
    `<svg width="154px" height="215px" version="1.1">` +
    `<svg class="definition-scale" viewBox="0 0 ${width} ${height}">` +
    `${staff}<g class="notehead"><use transform="translate(400, 420)" /></g>` +
    // A stem is vertical, so it must not widen the crop.
    `<path d="M400 420 L400 900" />` +
    `</svg></svg>`
  )
}

const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)?.[1]

describe('cropToStaff', () => {
  it('frames the drawing on its staff', () => {
    // Verovio lays the music out from the left and stops wherever the content
    // ends, so the box is wider than the staff by a varying amount — which is
    // what leaves a key looking off-centre.
    expect(viewBox(cropToStaff(drawing({ from: 60, to: 870 })))).toBe('60 0 810 1700')
  })

  it('follows the staff when an accidental makes it wider', () => {
    expect(viewBox(cropToStaff(drawing({ to: 1160 })))).toBe('60 0 1100 1700')
  })

  it('leaves the height alone, so every staff sits at the same level', () => {
    // Vertical is deliberately untouched: where the note falls on the staff is
    // the whole point, and cropping to it per key would slide the staff about.
    for (const to of [600, 870, 1160]) {
      expect(viewBox(cropToStaff(drawing({ to })))?.split(' ')[3]).toBe('1700')
      expect(viewBox(cropToStaff(drawing({ to })))?.split(' ')[1]).toBe('0')
    }
  })

  it('is not widened by a stem or any other upright stroke', () => {
    const wide = cropToStaff(drawing({ from: 60, to: 300 }))
    expect(viewBox(wide)).toBe('60 0 240 1700')
  })

  it('rewrites the outer size to match the new shape', () => {
    const cropped = cropToStaff(drawing({ from: 60, to: 910, height: 1700 }))
    const width = Number(cropped.match(/^<svg[^>]*?width="(\d+)px"/)?.[1])
    const height = Number(cropped.match(/^<svg[^>]*?height="(\d+)px"/)?.[1])

    expect(height).toBe(100)
    // 850 wide over 1700 tall is half as wide as it is high.
    expect(width).toBe(50)
  })

  it('leaves a drawing it does not understand exactly as it found it', () => {
    // Better a key that is off-centre than one that is cropped through.
    const noViewBox = '<svg width="10px" height="10px"><path d="M0 0 L5 0" /></svg>'
    expect(cropToStaff(noViewBox)).toBe(noViewBox)

    const noLines = '<svg width="10px" height="10px"><svg viewBox="0 0 100 100"/></svg>'
    expect(cropToStaff(noLines)).toBe(noLines)

    const upright = drawing({ lines: [] })
    expect(cropToStaff(upright)).toBe(upright)
  })
})
