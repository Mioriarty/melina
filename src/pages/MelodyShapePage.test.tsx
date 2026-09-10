import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { comparisonRows } from '@/components/explain/contourSeries'
import { i18n } from '@/lib/i18n'
import { LANGUAGES } from '@/lib/i18n/languages'

import MelodyShapePage from './MelodyShapePage'

/**
 * The guide behind the Melodic shape setting.
 *
 * What is worth pinning is not the prose — `locales.test.ts` already holds the
 * two languages to the same keys — but that the page still *renders* its
 * figures, and that those figures are the model rather than a picture of it.
 */

function open() {
  return render(
    <MemoryRouter>
      <MelodyShapePage />
    </MemoryRouter>,
  )
}

const guide = (key: string) => i18n.t(`guide:${key}`)

describe('the melodic shape guide', () => {
  it('renders every section', () => {
    open()

    expect(
      screen.getByRole('heading', { level: 1, name: guide('shape.title') }),
    ).toBeTruthy()
    for (const section of ['order', 'first', 'next', 'paced', 'steady', 'rules']) {
      expect(
        screen.getByRole('heading', { level: 2, name: guide(`${section}.title`) }),
        section,
      ).toBeTruthy()
    }
  })

  it('goes back to the settings it was opened from, not to the level list', () => {
    // The settings themselves survive in Dexie; which screen was showing does
    // not, so the return trip has to say where to land.
    open()

    const back = screen.getByRole('link', { name: guide('back') })
    expect(back.getAttribute('href')).toBe('/train/dictation/short-melodies?screen=setup')
  })

  it('draws all three figures, each with a description', () => {
    open()

    for (const key of ['curves.figureLabel', 'width.figureLabel', 'steady.figureLabel']) {
      expect(screen.getByRole('img', { name: guide(key) }), key).toBeTruthy()
    }
  })

  it('lists every compared interval in the table', () => {
    open()

    const rows = comparisonRows()
    expect(rows.length).toBeGreaterThan(3)
    for (const row of rows) {
      expect(
        screen.getByRole('rowheader', {
          name: guide(`compare.intervals.${row.semitones}`),
        }),
        String(row.semitones),
      ).toBeTruthy()
    }
  })

  it('reads in every language', () => {
    // A guide that falls back to English inside a German app is worse than no
    // guide: it looks like a bug in the page rather than a missing string.
    for (const { id: language } of LANGUAGES) {
      const t = i18n.getFixedT(language)
      for (const key of ['shape.title', 'paced.body', 'steady.caption', 'rules.range']) {
        const value = t(`guide:${key}`)
        expect(value, `${language}: ${key}`).not.toBe(`guide:${key}`)
        expect(value.length, `${language}: ${key}`).toBeGreaterThan(10)
      }
    }
  })
})

describe('the figures are the model, not a picture of it', () => {
  it('shows a leap growing likelier as the gap grows', () => {
    // The claim the whole page rests on. If the shares were hand-written they
    // could say this while the code said something else; they are computed, so
    // this test fails the moment the model stops agreeing.
    for (const row of comparisonRows()) {
      if (row.semitones === 0) continue

      for (let index = 1; index < row.shares.length; index += 1) {
        expect(
          row.shares[index],
          `${row.semitones} semitones, gap ${index}`,
        ).toBeGreaterThan(row.shares[index - 1] as number)
      }
    }
  })

  it('shows a repeated note damped at every gap', () => {
    const [repeat, step] = comparisonRows()
    expect(repeat?.semitones).toBe(0)

    for (const [index, share] of (repeat?.shares ?? []).entries()) {
      expect(share, `gap ${index}`).toBeLessThan(step?.shares[index] as number)
    }
  })

  it('keeps every share above zero, since nothing is forbidden', () => {
    for (const row of comparisonRows()) {
      for (const share of row.shares) expect(share).toBeGreaterThan(0)
    }
  })
})
