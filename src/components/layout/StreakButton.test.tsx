import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { AttemptQuestion } from '@/lib/db/attemptQuestion'
import { db } from '@/lib/db/schema'

import { StreakButton } from './StreakButton'

/**
 * The streak in the header.
 *
 * The one number on screen at all times, so its rule has to be right: a
 * player who practised yesterday and has not started today must see their
 * streak standing, greyed, rather than reset to nothing.
 */

const QUESTION: AttemptQuestion = {
  kind: 'interval',
  lower: 'C4',
  interval: 'P5',
  clef: 'treble',
  keySignature: '0',
  direction: 'harmonic',
}

function daysAgo(back: number): number {
  const date = new Date()
  date.setDate(date.getDate() - back)
  date.setHours(12, 0, 0, 0)
  return date.getTime()
}

async function practisedOn(...backs: readonly number[]) {
  await db.attempts.bulkAdd(
    backs.map((back) => ({
      exerciseId: 'intervals/reading',
      ts: daysAgo(back),
      correct: true,
      question: QUESTION,
      answered: 'P5',
      ms: 1000,
    })),
  )
}

function renderButton() {
  render(
    <MemoryRouter>
      <StreakButton />
    </MemoryRouter>,
  )
}

describe('StreakButton', () => {
  it('leads to Progress', async () => {
    renderButton()
    expect((await screen.findByRole('link')).getAttribute('href')).toBe('/progress')
  })

  it('lights up once something has been answered today', async () => {
    await practisedOn(2, 1, 0)
    renderButton()

    const link = await screen.findByRole('link', { name: /including today/ })
    expect(link.textContent).toBe('3')
    // Colour alone would leave a colour-blind player with no state at all,
    // so the flame is filled as well as tinted.
    expect(link.className).toContain('text-accent')
  })

  it('greys out but keeps the count on a day not yet used', async () => {
    await practisedOn(2, 1)
    renderButton()

    const link = await screen.findByRole('link', { name: /nothing practised today/ })
    expect(link.textContent).toBe('2')
    expect(link.className).toContain('text-ink-faint')
  })

  it('drops to nothing once a whole day has been missed', async () => {
    await practisedOn(3, 2)
    renderButton()

    const link = await screen.findByRole('link', { name: /No streak yet/ })
    // No zero beside the flame: it would read as a score rather than as an
    // invitation to start one.
    expect(link.textContent).toBe('')
  })

  it('shows the flame alone before anything has ever been practised', async () => {
    renderButton()
    expect((await screen.findByRole('link')).textContent).toBe('')
  })
})
