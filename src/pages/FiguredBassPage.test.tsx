import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  canonicalFigures,
  figureKey,
  figurePitches,
  parseFigureKey,
  type Figure,
} from '@/lib/music/figuredBass'
import { i18n } from '@/lib/i18n'
import { parsePitch, type Pitch } from '@/lib/music/pitch'

import FiguredBassPage from './FiguredBassPage'
import { GUIDE_EXAMPLES } from './figuredBassExamples'

/**
 * The guide, against the model it describes.
 *
 * It asserts what the page *says* rather than how it looks, so the page fails
 * rather than lies if the figure model changes underneath it — the same job
 * `MelodyShapePage.test.ts` does for the contour figures.
 *
 * The engraver is stubbed: it is 7 MB of WebAssembly that jsdom cannot
 * instantiate, and what it draws is covered by `thoroughbassVerovio.test.ts`
 * against the real toolkit. What matters here is that every example is built
 * and handed to it.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

function open(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/guide/figured-bass${search}`]}>
      <FiguredBassPage />
    </MemoryRouter>,
  )
}

const backLink = () =>
  screen
    .getAllByRole('link')
    .find(
      (link) =>
        (link.getAttribute('href') ?? '').includes('screen=setup') ||
        link.getAttribute('href') === '/',
    )

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

describe('the engraved examples', () => {
  it('draws a staff for every example the page asks for', async () => {
    open()
    // Nine: the printed/played pair, two for counting up from the bass, two
    // for the key signature, two more pairs for the omissions, two for the
    // accidentals and Grove's own. A page that quietly stopped building them
    // would still read perfectly well, which is why this is counted.
    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(9)
    })
  })

  it('shows the same figure over two different basses, and says what each comes to', () => {
    // The single idea the page is built around: a figure is counted from
    // whatever bass it stands under, so the same 6 is a different note.
    open()
    expect(screen.getByText(i18n.t('guide:figures.reading.overC'))).toBeTruthy()
    expect(screen.getByText(i18n.t('guide:figures.reading.overE'))).toBeTruthy()
  })

  it('puts what is printed beside what is played', async () => {
    open()
    await waitFor(() => {
      // The gap between the two *is* what a figured bass is, so both captions
      // have to be on the page for the comparison to say anything.
      expect(screen.getAllByText(i18n.t('guide:figures.printed')).length).toBeGreaterThan(
        0,
      )
      expect(screen.getAllByText(i18n.t('guide:figures.played')).length).toBeGreaterThan(
        0,
      )
    })
  })
})

describe('what the examples are allowed to print', () => {
  it('never shows a figure the exercise would mark wrong', () => {
    // **The guide may not contradict itself.** A page that teaches "a figure
    // writes only what is not obvious" and then draws `♭5/3` — with a 3 the
    // rule it has just stated says not to write — is worse than no page, and
    // nothing about the types would catch it. Held to the same
    // `canonicalFigures` the figuring exercise grades against.
    for (const [name, example] of Object.entries(GUIDE_EXAMPLES)) {
      const bass = parsePitch(example.bass) as Pitch
      const figure = parseFigureKey(example.figure) as Figure
      expect(bass, name).toBeDefined()
      expect(figure, name).toBeDefined()

      const notes = figurePitches(bass, example.keySignature, figure)
      expect(notes, name).toBeDefined()

      const accepted = canonicalFigures(bass, example.keySignature, notes ?? []).map(
        figureKey,
      )
      expect(accepted, `${name} prints a figure that is not conventional`).toContain(
        figureKey(figure),
      )
    }
  })

  it('spells every example as a note that can be written', () => {
    for (const [name, example] of Object.entries(GUIDE_EXAMPLES)) {
      const bass = parsePitch(example.bass) as Pitch
      const figure = parseFigureKey(example.figure) as Figure
      for (const note of figurePitches(bass, example.keySignature, figure) ?? []) {
        expect(Math.abs(note.alteration), name).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('getting back, and getting on', () => {
  it('returns to the exercise it was opened from, on the setup screen', () => {
    open('?from=realizing')
    expect(backLink()?.getAttribute('href')).toBe(
      '/train/thoroughbass/realizing?screen=setup',
    )
  })

  it('goes back to the path when it was reached from there', () => {
    // Which is the way in that matters: it is a stop on the path, and only
    // secondarily the question mark on a settings screen.
    open()
    expect(backLink()?.getAttribute('href')).toBe('/')
  })

  it('ignores a `from` it does not recognise rather than trusting it', () => {
    open('?from=../elsewhere')
    expect(backLink()?.getAttribute('href')).toBe('/')
  })

  it('offers both exercises at the end, because reading it is not the point', () => {
    open()
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/train/thoroughbass/figuring')
    expect(hrefs).toContain('/train/thoroughbass/realizing')
  })
})
