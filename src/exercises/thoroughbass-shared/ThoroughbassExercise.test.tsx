import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import ThoroughbassFiguringExercise from '../thoroughbass-figuring/ThoroughbassFiguringExercise'
import ThoroughbassRealizingExercise from '../thoroughbass-realizing/ThoroughbassRealizingExercise'

/**
 * Render smoke tests for both directions of thoroughbass.
 *
 * A clean typecheck is not evidence that an exercise runs: everything is wired
 * through a registry, a settings table and a generic round machine, and any of
 * those joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the instrument are stubbed — one is 7 MB of WebAssembly and
 * the other wants an AudioContext jsdom does not have. Both are covered on
 * their own elsewhere.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const playStruck = vi.fn(() => Promise.resolve())

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  playStruck: (...args: unknown[]) => playStruck(...(args as [])),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

const t = (key: string) => i18n.t(key)
/** The same, for the keys that take a placeholder. */
const tv = (key: string, options: Record<string, unknown>) => i18n.t(key, options)

function open(Exercise: () => React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Exercise />
    </MemoryRouter>,
  )
}

const level = (group: string, id: string) => t(`levels:${group}.${id}.title`)

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

function press(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** The pitch keys of the realising keyboard: the ones naming a note and octave. */
function noteKeys(): HTMLElement[] {
  return screen
    .queryAllByRole('button')
    .filter((button) =>
      /^[A-G]( flat| sharp)? \d$/.test(button.getAttribute('aria-label') ?? ''),
    )
}

describe('figuring a bass', () => {
  it('opens on the levels, and starts a round in the same tap', async () => {
    open(ThoroughbassFiguringExercise, '/train/thoroughbass/figuring')

    await screen.findByText(level('thoroughbass-figuring', 'triads'))
    press(new RegExp(level('thoroughbass-figuring', 'triads')))

    await screen.findByText(t('exercise:round.prompt.figuring'))
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('lays out a telephone pad with the figures on it', async () => {
    open(ThoroughbassFiguringExercise, '/train/thoroughbass/figuring')
    await screen.findByText(level('thoroughbass-figuring', 'triads'))
    press(new RegExp(level('thoroughbass-figuring', 'triads')))
    await screen.findByText(t('exercise:round.prompt.figuring'))

    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(
        screen.getByRole('button', {
          name: tv('exercise:figuring.keyboard.digit', { number: digit }),
        }),
      ).toBeTruthy()
    }
    expect(
      screen.getByRole('button', { name: t('exercise:figuring.keyboard.done') }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: t('exercise:figuring.keyboard.next') }),
    ).toBeTruthy()
  })

  it('answers the moment done is pressed, with nothing typed', async () => {
    // Submitting nothing is a real answer: a plain triad is figured by writing
    // no figure at all.
    open(ThoroughbassFiguringExercise, '/train/thoroughbass/figuring')
    await screen.findByText(level('thoroughbass-figuring', 'triads'))
    press(new RegExp(level('thoroughbass-figuring', 'triads')))
    await screen.findByText(t('exercise:round.prompt.figuring'))

    press(t('exercise:figuring.keyboard.done'))

    // Either it was right and the round moves on, or it was wrong and the
    // verdict explains which kind of wrong — both are proof the answer landed.
    await waitFor(() => {
      const feedback =
        screen.queryByText(t('exercise:round.correct')) ??
        screen.queryByRole('button', { name: new RegExp(t('exercise:round.next')) })
      expect(feedback).toBeTruthy()
    })
  })
})

describe('realising a bass', () => {
  it('opens on the levels, and starts a round in the same tap', async () => {
    open(ThoroughbassRealizingExercise, '/train/thoroughbass/realizing')

    await screen.findByText(level('thoroughbass-realizing', 'triads'))
    press(new RegExp(level('thoroughbass-realizing', 'triads')))

    await screen.findByText(t('exercise:round.prompt.realizing'))
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('offers a key per note of the scale, and answers when the chord is full', async () => {
    open(ThoroughbassRealizingExercise, '/train/thoroughbass/realizing')
    await screen.findByText(level('thoroughbass-realizing', 'triads'))
    press(new RegExp(level('thoroughbass-realizing', 'triads')))
    await screen.findByText(t('exercise:round.prompt.realizing'))

    expect(noteKeys()).toHaveLength(7)

    // A triad wants two notes above the bass, and there is no confirm key —
    // the second press is the one that completes it.
    fireEvent.click(noteKeys()[0] as HTMLElement)
    fireEvent.click(noteKeys()[1] as HTMLElement)

    await waitFor(() => {
      const feedback =
        screen.queryByText(t('exercise:round.correct')) ??
        screen.queryByRole('button', { name: new RegExp(t('exercise:round.next')) })
      expect(feedback).toBeTruthy()
    })
  })

  it('does not offer to play the chord before it has been answered', async () => {
    // The chord is the answer here. Sounding it would give it away.
    const { container } = open(
      ThoroughbassRealizingExercise,
      '/train/thoroughbass/realizing',
    )
    await screen.findByText(level('thoroughbass-realizing', 'triads'))
    press(new RegExp(level('thoroughbass-realizing', 'triads')))
    await screen.findByText(t('exercise:round.prompt.realizing'))

    expect(labels(container)).not.toContain(
      tv('exercise:play.scoreLabel', { notes: '' }).trim(),
    )
    expect(playStruck).not.toHaveBeenCalled()
  })
})

describe('the strings a shared screen reads', () => {
  it('never names one direction on the other one', async () => {
    // The shared screens are generic over what is being asked, and a string
    // that names the wrong half of the subject is how that generality leaks.
    // Checked in accessible names as well as visible text, because an
    // icon-only button says nothing in its text.
    const { container } = open(
      ThoroughbassRealizingExercise,
      '/train/thoroughbass/realizing',
    )
    await screen.findByText(level('thoroughbass-realizing', 'triads'))
    press(new RegExp(level('thoroughbass-realizing', 'triads')))
    await screen.findByText(t('exercise:round.prompt.realizing'))

    const said = `${container.textContent ?? ''} | ${labels(container)}`.toLowerCase()
    expect(said).not.toContain(t('exercise:round.prompt.figuring').toLowerCase())
    expect(said).not.toContain('interval')
  })
})
