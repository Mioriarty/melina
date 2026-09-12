import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
  modeSummaries,
  modeSummary,
  degreeShorthand,
} from '@/components/explain/modeSeries'
import { orderedPathNodes } from '@/config/pathLayout'
import { i18n } from '@/lib/i18n'
import { intervalSemitones } from '@/lib/music/interval'
import {
  DIATONIC_MODE_IDS,
  MINOR_SCALE_IDS,
  getMode,
  MODE_IDS,
  type ModeId,
} from '@/lib/music/scale'

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
    for (const section of ['what', 'list', 'minors', 'table', 'spelling', 'next']) {
      expect(
        screen.getByRole('heading', { level: 2, name: guide(`modes.${section}.title`) }),
        section,
      ).toBeTruthy()
    }
  })

  it('writes out all nine scales and puts all nine in the table', () => {
    open()

    for (const id of MODE_IDS) {
      expect(screen.getByRole('heading', { level: 3, name: mode(id) }), id).toBeTruthy()
      // Once as a card heading and once as the table's row header.
      expect(screen.getAllByText(mode(id)).length, id).toBeGreaterThanOrEqual(2)
    }
  })

  it('says which degree a mode begins on, and says the other thing for the two that do not', () => {
    // Harmonic and melodic minor are not rotations of the major scale, so
    // there is no degree they could be said to begin on. The card has to say
    // something there rather than print "Degree undefined".
    open()

    for (const id of DIATONIC_MODE_IDS) {
      const degree = getMode(id).degree
      expect(degree, id).toBeDefined()
      expect(
        screen.getAllByText(
          guide('modes.mode.degree').replace('{{degree}}', String(degree)),
        ).length,
        id,
      ).toBeGreaterThan(0)
    }

    expect(screen.getAllByText(guide('modes.mode.altered'))).toHaveLength(
      MINOR_SCALE_IDS.length,
    )
  })

  it('goes back to the settings it was opened from, not to the level list', () => {
    // The settings themselves survive in Dexie; which screen was showing does
    // not, so the return trip has to say where to land.
    open()

    const back = screen.getByRole('link', { name: guide('back') })
    expect(back.getAttribute('href')).toBe('/train/scales/reading?screen=setup')
  })

  it('goes back to the path when that is where it was opened from', () => {
    // Two ways in means two ways back, and no `?from=` at all is the station.
    render(
      <MemoryRouter initialEntries={['/guide/scales']}>
        <ModesPage />
      </MemoryRouter>,
    )

    const back = screen.getByRole('link', { name: guide('backToPath') })
    expect(back.getAttribute('href')).toBe('/')
  })

  it('stands on the path before the scale exercises it serves', () => {
    // A guide exists to be read first, so it cannot sit below the exercises
    // that assume it. `orderedPathNodes` walks by position, not by registry.
    const walked = orderedPathNodes().map((node) => node.station.id)
    const guideAt = walked.indexOf('guide/scales')

    expect(guideAt, 'the modes guide is not on the path').toBeGreaterThan(-1)
    for (const id of ['scales/reading', 'scales/hearing', 'scales/degrees']) {
      expect(walked.indexOf(id), id).toBeGreaterThan(guideAt)
    }
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

  it('reads the two minor scales the way the rule comes out', () => {
    // Harmonic minor is the expected answer — minor with a raised seventh.
    // Melodic minor is the one worth pinning, because the rule sends it the
    // other way: it is a single note from major and two from minor, so that
    // is what the page prints. An exception for a scale whose *name* suggests
    // otherwise would be the page describing something the model does not.
    const named = (id: ModeId) =>
      modeSummary(id).changes.map(
        (change) => `${change.interval.quality} ${change.interval.number}`,
      )

    expect(modeSummary('harmonicMinor').reference).toBe('aeolian')
    expect(named('harmonicMinor')).toEqual(['major 7'])
    expect(modeSummary('melodicMinor').reference).toBe('ionian')
    expect(named('melodicMinor')).toEqual(['minor 3'])

    // And neither begins on a degree of the major scale.
    for (const id of MINOR_SCALE_IDS) expect(modeSummary(id).degree, id).toBeUndefined()
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
