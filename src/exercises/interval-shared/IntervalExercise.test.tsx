import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import IntervalHearingExercise from '@/exercises/interval-hearing/IntervalHearingExercise'
import IntervalReadingExercise from '@/exercises/interval-reading/IntervalReadingExercise'
import { i18n } from '@/lib/i18n'

/**
 * Render smoke tests for the interval pair.
 *
 * These exist because the round machinery underneath them was generalised to
 * serve the scale exercises as well, and a refactor that typechecks perfectly
 * can still leave a screen that never mounts. The engraver and the sampler are
 * stubbed; both are covered on their own elsewhere.
 */
vi.mock('@/lib/notation/verovio', () => ({
  preloadEngraver: () => undefined,
  renderMei: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  DEFAULT_NOTE_SPACING: 0.25,
  SCALE_NOTE_SPACING: 0.45,
}))

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: () => Promise.resolve({}),
  playInterval: () => Promise.resolve(),
  unlockAudio: () => Promise.resolve(),
}))

function open(element: React.ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>)
}

const level = (group: string, id: string) => i18n.t(`levels:${group}.${id}.title`)

describe.each([
  {
    name: 'Interval Reading',
    group: 'interval-reading',
    first: 'first-steps',
    element: <IntervalReadingExercise />,
  },
  {
    name: 'Interval Hearing',
    group: 'interval-hearing',
    first: 'open-intervals',
    element: <IntervalHearingExercise />,
  },
])('$name', ({ name, group, first, element }) => {
  it('lands on its levels', async () => {
    open(element)

    expect(await screen.findByRole('heading', { name })).toBeTruthy()
    expect(screen.getByText(level(group, first))).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('starts a round from a level and reveals a wrong answer', async () => {
    open(element)
    fireEvent.click(await screen.findByText(level(group, first)))

    expect(await screen.findByText('What interval is this?')).toBeTruthy()
    const keyboard = screen.getByRole('group', { name: 'Interval answers' })

    // Answer every offered interval in turn: one of them is this question's,
    // and the rest are wrong — either way the round has to reveal something.
    const keys = [...keyboard.querySelectorAll<HTMLElement>('[data-interval]')]
    expect(keys.length).toBeGreaterThan(1)
    fireEvent.click(keys[0] as HTMLElement)

    await waitFor(() => {
      const revealed = keys.filter((key) => key.className.includes('bg-correct'))
      expect(revealed).toHaveLength(1)
    })
  })
})
