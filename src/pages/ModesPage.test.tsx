import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  modeSummaries,
  modeSummary,
  degreeShorthand,
} from '@/components/explain/modeSeries'
import { i18n } from '@/lib/i18n'
import { intervalSemitones } from '@/lib/music/interval'
import { getMode, MODE_IDS, type ModeId } from '@/lib/music/scale'

import ModesPage from './ModesPage'

/**
 * The guide behind the Modes setting.
 *
 * Two things are worth pinning, and the prose is neither — `locales.test.ts`
 * already holds the two languages to the same keys.
 *
 * The first is that the page still **renders**. The second is that what it
 * says is `scale.ts` rather than a copy of it: "lydian is major with an
 * augmented fourth" has to be the difference between two rows of the model, or
 * the page can come to describe something the app no longer does.
 */

vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

function open() {
  return render(
    <MemoryRouter initialEntries={['/guide/scales?from=reading']}>
      <ModesPage />
    </MemoryRouter>,
  )
}

const guide = (key: string) => i18n.t(`guide:${key}`)
const mode = (id: ModeId) => i18n.t(`music:modes.${id}.label`)

describe('the modes guide', () => {
  it('renders every section', () => {
    open()

    expect(
      screen.getByRole('heading', { level: 1, name: guide('modes.title') }),
    ).toBeTruthy()
    for (const section of ['what', 'list', 'table', 'spelling', 'next']) {
      expect(
        screen.getByRole('heading', { level: 2, name: guide(`modes.${section}.title`) }),
        section,
      ).toBeTruthy()
    }
  })

  it('writes out all seven modes and puts all seven in the table', () => {
    open()

    for (const id of MODE_IDS) {
      expect(screen.getByRole('heading', { level: 3, name: mode(id) }), id).toBeTruthy()
      // Once as a card heading and once as the table's row header.
      expect(screen.getAllByText(mode(id)).length, id).toBeGreaterThanOrEqual(2)
    }
  })

  it('goes back to the settings it was opened from, not to the level list', () => {
    open()

    const back = screen.getByRole('link', { name: guide('back') })
    expect(back.getAttribute('href')).toBe('/train/scales/reading?screen=setup')
  })
})

describe('the shortcut', () => {
  it('reads every mode against the closer of major and minor', () => {
    // The rule is *whichever is fewer notes away*, and it has to be a rule
    // rather than a choice: saying dorian is minor with a major sixth rather
    // than major with a flattened third and seventh is the whole value of it.
    for (const summary of modeSummaries()) {
      const other = summary.reference === 'ionian' ? 'aeolian' : 'ionian'
      const against = (from: ModeId) =>
        getMode(summary.id)
          .intervals.slice(0, 7)
          .filter((interval, at) => {
            const was = getMode(from).intervals[at]
            return (
              was !== undefined && intervalSemitones(interval) !== intervalSemitones(was)
            )
          }).length

      expect(summary.changes.length, summary.id).toBe(against(summary.reference))
      // Strictly fewer, so nothing here rests on a tie being broken one way.
      if (summary.id !== 'ionian' && summary.id !== 'aeolian') {
        expect(against(summary.reference), summary.id).toBeLessThan(against(other))
      }
    }
  })

  it('is the one everybody already says', () => {
    // The three the page would be worthless without, spelled out. These are
    // assertions about the model, not about the wording.
    const named = (id: ModeId) =>
      modeSummary(id).changes.map(
        (change) => `${change.interval.quality} ${change.interval.number}`,
      )

    expect(modeSummary('lydian').reference).toBe('ionian')
    expect(named('lydian')).toEqual(['augmented 4'])
    expect(modeSummary('mixolydian').reference).toBe('ionian')
    expect(named('mixolydian')).toEqual(['minor 7'])
    expect(modeSummary('dorian').reference).toBe('aeolian')
    expect(named('dorian')).toEqual(['major 6'])
    // Major and minor are what everything else is read against, so they have
    // nothing to differ from.
    expect(named('ionian')).toEqual([])
    expect(named('aeolian')).toEqual([])
  })

  it('writes the shorthand from the intervals, not from a second list', () => {
    // `1 2 ♭3 4 5 6 ♭7` has to *be* the mode: take the major scale's degree,
    // move it by what the sign says, and the mode's own interval is what you
    // get. A hand-written shorthand could drift from the staff beside it.
    for (const summary of modeSummaries()) {
      for (const degree of summary.degrees) {
        const where = `${summary.id} ${degree.number}`
        const major = getMode('ionian').intervals[degree.number - 1]
        if (major === undefined) throw new Error(`no major degree for ${where}`)
        expect((intervalSemitones(major) ?? 0) + degree.against, where).toBe(
          intervalSemitones(degree.interval),
        )

        const shorthand = degreeShorthand(degree)
        expect(shorthand.endsWith(String(degree.number)), shorthand).toBe(true)
        expect(shorthand.startsWith('♭'), shorthand).toBe(degree.against < 0)
        expect(shorthand.startsWith('♯'), shorthand).toBe(degree.against > 0)
      }
    }
  })
})
