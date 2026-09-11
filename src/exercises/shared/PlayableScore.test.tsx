import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PlayableScore } from './PlayableScore'

/**
 * The notation frames the same way whether or not it is pressable.
 *
 * It used not to. A plain score was a direct child of the stretching row, so a
 * box capped below the room available sat at the top of it, while the button
 * branch centred its contents and took a little width for its own padding. The
 * effect was that a reading question's notation **shifted and resized the
 * moment its answer arrived**, because that is when the play button appears.
 *
 * jsdom has no layout engine, so this cannot measure where the staff lands.
 * What it can hold is the thing that decided it: both branches wrap the score
 * in the same frame, and the button only adds what a button needs.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const MEI = '<mei/>'

async function frameOf(onPlay?: () => void) {
  const { unmount } = render(
    <PlayableScore
      mei={MEI}
      label="a staff"
      {...(onPlay === undefined ? {} : { onPlay })}
    />,
  )
  const score = await waitFor(() => screen.getByRole('img'))
  const frame = score.parentElement as HTMLElement
  const classes = frame.className.split(/\s+/).filter(Boolean)
  unmount()
  return classes
}

describe('the frame around the notation', () => {
  it('is the same whether or not the staff can be pressed', async () => {
    const plain = await frameOf()
    const pressable = await frameOf(() => undefined)

    // Everything the plain one has, the button has too — so the staff is
    // centred and sized identically in both, and revealing an answer does not
    // move it.
    for (const className of plain) {
      expect(pressable, `the button drops ${className}`).toContain(className)
    }
    expect(plain).toContain('items-center')
    expect(plain).toContain('h-full')
  })

  it('adds only what a button needs on top of it', async () => {
    const plain = await frameOf()
    const pressable = await frameOf(() => undefined)

    const extra = pressable.filter((className) => !plain.includes(className))
    // Press feedback and a hover tint — nothing that changes where the staff
    // sits or how big it is drawn.
    for (const className of extra) {
      expect(className, `${className} is not press feedback`).toMatch(
        /^(hover:|active:|disabled:|transition|duration-)/,
      )
    }
  })
})
