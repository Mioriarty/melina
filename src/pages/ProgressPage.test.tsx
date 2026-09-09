import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { AttemptQuestion } from '@/lib/db/attemptQuestion'
import { db, type AttemptRow } from '@/lib/db/schema'

import ProgressPage from './ProgressPage'

/**
 * Progress.
 *
 * A screen made entirely of derived numbers, which is exactly the kind that
 * can render a confident wrong answer without crashing. These check the
 * figures against practice that was written down on purpose.
 */

const INTERVAL: AttemptQuestion = {
  kind: 'interval',
  lower: 'C4',
  interval: 'P5',
  clef: 'treble',
  keySignature: '0',
  direction: 'harmonic',
}

const SCALE: AttemptQuestion = {
  kind: 'scale',
  tonic: 'C4',
  mode: 'dorian',
  clef: 'bass',
  direction: 'ascending',
}

/** Local noon `back` days ago, so no timezone can shift the day. */
function daysAgo(back: number): number {
  const date = new Date()
  date.setDate(date.getDate() - back)
  date.setHours(12, 0, 0, 0)
  return date.getTime()
}

async function log(
  entries: readonly {
    back: number
    correct: number
    wrong: number
    exerciseId?: string
    question?: AttemptQuestion
  }[],
) {
  const rows: AttemptRow[] = []
  for (const entry of entries) {
    for (let index = 0; index < entry.correct + entry.wrong; index += 1) {
      rows.push({
        exerciseId: entry.exerciseId ?? 'intervals/reading',
        ts: daysAgo(entry.back) + index,
        correct: index < entry.correct,
        question: entry.question ?? INTERVAL,
        answered: 'P5',
        ms: 1000,
      })
    }
  }
  await db.attempts.bulkAdd(rows)
}

function renderPage() {
  render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  )
}

describe('ProgressPage', () => {
  it('says there is nothing yet rather than drawing an empty chart', async () => {
    renderPage()

    expect(await screen.findByText(/Nothing practised yet/)).toBeTruthy()
    // A chart of zeroes would suggest a bad run rather than no run at all.
    expect(screen.queryByRole('group', { name: 'Time span' })).toBeNull()
  })

  it('totals every answer ever given', async () => {
    await log([
      { back: 0, correct: 8, wrong: 2 },
      { back: 3, correct: 5, wrong: 5 },
    ])

    renderPage()

    const totals = within(await screen.findByRole('region', { name: 'Totals' }))
    expect(totals.getByText('20')).toBeTruthy()
    // Two days practised, 13 of 20 right.
    expect(totals.getByText('2')).toBeTruthy()
    expect(totals.getByText('65%')).toBeTruthy()
  })

  it('describes the day behind a column when it is picked', async () => {
    await log([{ back: 1, correct: 9, wrong: 1 }])

    renderPage()
    await screen.findByRole('group', { name: 'Time span' })

    // Every column is a real button, so the chart is reachable by keyboard
    // and says what it holds rather than relying on a hover tooltip.
    const column = screen.getAllByRole('button', {
      name: /10 answers, 90% correct/,
    })[0]!
    fireEvent.click(column)

    expect(screen.getAllByText(/10 answers, 90% correct/).length).toBeGreaterThan(0)
  })

  it('counts an untouched day as nothing practised, not as nothing known', async () => {
    await log([{ back: 2, correct: 4, wrong: 0 }])

    renderPage()
    await screen.findByRole('group', { name: 'Time span' })

    expect(
      screen.getAllByRole('button', { name: /nothing practised/ }).length,
    ).toBeGreaterThan(0)
  })

  it('ranks each dimension weakest first', async () => {
    // A fifth answered well and a fourth answered badly: the fourth is the
    // one to practise, so it goes at the top.
    await log([
      { back: 0, correct: 9, wrong: 1 },
      { back: 0, correct: 2, wrong: 8, question: { ...INTERVAL, interval: 'P4' } },
    ])

    renderPage()
    const intervals = await screen.findByRole('heading', { name: 'Intervals' })
    const list = intervals.parentElement!.querySelector('ul')!

    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      expect.stringContaining('Perfect fourth'),
      expect.stringContaining('Perfect fifth'),
    ])
  })

  it('names music in words rather than in machine keys', async () => {
    await log([
      { back: 0, correct: 3, wrong: 1, exerciseId: 'scales/hearing', question: SCALE },
    ])

    renderPage()
    await screen.findByRole('heading', { name: 'Modes' })

    expect(screen.getByText('Dorian')).toBeTruthy()
    expect(screen.getByText('Bass')).toBeTruthy()
    expect(screen.getByText('Scale Hearing')).toBeTruthy()
    // The stored form must never reach the screen.
    expect(screen.queryByText('scales/hearing')).toBeNull()
  })

  it('keeps a scale out of the interval list and an interval out of the modes', async () => {
    await log([
      { back: 0, correct: 2, wrong: 0 },
      { back: 0, correct: 2, wrong: 0, exerciseId: 'scales/hearing', question: SCALE },
    ])

    renderPage()
    const modes = await screen.findByRole('heading', { name: 'Modes' })
    const list = modes.parentElement!.querySelector('ul')!

    expect(list.querySelectorAll('li')).toHaveLength(1)
  })

  it('offers the longer spans and remembers which one is chosen', async () => {
    await log([{ back: 40, correct: 5, wrong: 5 }])

    renderPage()
    const ranges = within(await screen.findByRole('group', { name: 'Time span' }))

    // Forty days ago is off the end of a fortnight; the eight-week span is
    // what brings it back into view.
    expect(screen.queryByRole('button', { name: /5 answers, 50% correct/ })).toBeNull()

    fireEvent.click(ranges.getByRole('button', { name: '8 weeks' }))
    expect(ranges.getByRole('button', { name: '8 weeks' }).ariaPressed).toBe('true')
    expect(
      screen.getAllByRole('button', { name: /10 answers, 50% correct/ })[0],
    ).toBeTruthy()
  })

  it('draws six months of squares, starting on a Monday', async () => {
    await log([{ back: 0, correct: 1, wrong: 0 }])

    renderPage()
    await screen.findByRole('heading', { name: 'The last six months' })

    // A picture, not a hundred and eighty controls: half a year of squares
    // across a phone is a ten-pixel target, which no thumb can hit. Picking a
    // day belongs to the chart, whose columns are the height of the plot.
    const grid = screen.getByRole('img', { name: /one square per day/i })
    const squares = [...grid.children] as HTMLElement[]
    expect(squares.length).toBeGreaterThanOrEqual(26 * 7)

    // The grid fills column by column, so the range has to open on a Monday
    // or every square sits in the wrong weekday row.
    expect(squares[0]!.title).toMatch(/^Mon/)
  })
})
