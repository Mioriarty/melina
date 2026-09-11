import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import FiguredBassPage from './FiguredBassPage'

/**
 * The guide, against the model it describes.
 *
 * It asserts what the table *says* rather than how it looks, so the page fails
 * rather than lies if the figure model changes underneath it — the same job
 * `MelodyShapePage.test.ts` does for the contour figures.
 */
function open(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/guide/figured-bass${search}`]}>
      <FiguredBassPage />
    </MemoryRouter>,
  )
}

const row = (written: string) =>
  [...document.querySelectorAll('tbody tr')].find(
    (tr) => tr.querySelector('td')?.textContent === written,
  )

describe('the figure table', () => {
  it('resolves each figure to the notes it actually asks for', () => {
    open()

    // A sixth over E in C major is C, and the third it takes for granted is G.
    expect(row('6')?.textContent).toContain('C G')
    // And a flattened third is shown where it says something: in G major it
    // turns D major into D minor. In C major it would be a C flat — correct
    // arithmetic and a chord nobody has written.
    expect(row('♭')?.textContent).toContain('A F')
    // A plain triad over C is G and E — and it is written by writing nothing.
    expect(row(i18n.t('guide:figures.none'))?.textContent).toContain('G E')
    // A seventh over G is F, D, B: everything under the seventh assumed.
    expect(row('7')?.textContent).toContain('F D B')
  })

  it('shows what each figure stands for, not only what is written', () => {
    open()
    // The whole point of the middle column: 6 is 6 and 3, and 2 is 6, 4 and 2.
    expect(row('6')?.textContent).toContain('6 · 3')
    expect(row('2')?.textContent).toContain('6 · 4 · 2')
  })

  it('prints a bare accidental for an altered third, with no digit', () => {
    open()
    // "the Figure 3 being always suppressed … and the Accidental Sign alone
    // inserted in its place".
    expect(row('♯')).toBeDefined()
    expect(row('♯3')).toBeUndefined()
  })
})

describe('getting back', () => {
  it('returns to the exercise it was opened from, on the setup screen', () => {
    open('?from=realizing')
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/train/thoroughbass/realizing?screen=setup',
    )
  })

  it('falls back to figuring when it was reached without one', () => {
    open()
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/train/thoroughbass/figuring?screen=setup',
    )
  })
})
