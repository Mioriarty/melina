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
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>'),
}))

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  playInterval: vi.fn(() => Promise.resolve()),
  unlockAudio: vi.fn(() => Promise.resolve()),
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

describe('playing the notation', () => {
  const notation = () => screen.queryByRole('button', { name: /press to hear it/i })

  it('lets Interval Hearing replay at any time', async () => {
    const { playInterval } = await import('@/lib/audio/engine')
    const sound = vi.mocked(playInterval)

    open(<IntervalHearingExercise />)
    fireEvent.click(await screen.findByText(level('interval-hearing', 'open-intervals')))
    await screen.findByText('What interval is this?')

    const score = notation()
    expect(score).toBeTruthy()
    sound.mockClear()
    fireEvent.click(score as HTMLElement)
    await waitFor(() => expect(sound).toHaveBeenCalledTimes(1))
  })

  it('keeps Interval Reading silent until the answer is out', async () => {
    // Hearing the interval before answering would give the answer away.
    open(<IntervalReadingExercise />)
    fireEvent.click(await screen.findByText(level('interval-reading', 'first-steps')))
    await screen.findByText('What interval is this?')

    expect(notation()).toBeNull()

    const keys = [...document.querySelectorAll<HTMLElement>('[data-interval]')]
    fireEvent.click(keys[0] as HTMLElement)

    // Once revealed, the same notation becomes the play control.
    await waitFor(() => expect(notation()).toBeTruthy())
  })
})
