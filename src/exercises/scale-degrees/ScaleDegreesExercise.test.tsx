import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import ScaleDegreesExercise from './ScaleDegreesExercise'

/**
 * Render smoke tests for Scale Degrees.
 *
 * A clean typecheck is not evidence that an exercise runs: it is wired through
 * a registry, a settings table and a generic round machine, and any of those
 * joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the sampler are stubbed — one is 7 MB of WebAssembly and the
 * other wants an AudioContext jsdom does not have. Both are covered on their
 * own elsewhere.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const playDegrees = vi.fn(() => Promise.resolve())

vi.mock('@/lib/audio/engine', () => ({
  loadInstrument: vi.fn(() => Promise.resolve({})),
  playDegrees: (...args: unknown[]) => playDegrees(...(args as [])),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

function open() {
  return render(
    <MemoryRouter>
      <ScaleDegreesExercise />
    </MemoryRouter>,
  )
}

const level = (id: string) => i18n.t(`levels:scale-degrees.${id}.title`)
const degree = (n: number) => i18n.t(`music:degrees.${n}`)

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

async function startRound(id = 'first-five') {
  open()
  fireEvent.click(await screen.findByText(level(id)))
  return screen.findByRole('progressbar')
}

describe('Scale Degrees', () => {
  it('lands on its levels, not on a settings form', async () => {
    open()

    expect(await screen.findByRole('heading', { name: 'Scale Degrees' })).toBeTruthy()
    expect(screen.getByText(level('first-five'))).toBeTruthy()
    expect(screen.getByText(level('outside-the-key'))).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('starts a round from a level, in the same tap', async () => {
    await startRound()
    expect(screen.getByText('Which degrees do you hear?')).toBeTruthy()
  })

  it('plays the key and the melody without being asked', async () => {
    playDegrees.mockClear()
    await startRound()
    await waitFor(() => expect(playDegrees).toHaveBeenCalled())
  })

  it('names the key on screen, since the chord alone cannot', async () => {
    // The decision that replaces playing the mode out: a tonic triad cannot
    // tell one minor mode from another, so the screen says which it is.
    await startRound()
    // No trailing boundary: the label sits directly against the replay button's
    // text, so "A major" is followed by a letter rather than by a space.
    expect(document.body.textContent).toMatch(/\b[A-G][♯♭#b]? (major|minor)/)
  })

  it('offers a key per degree the level allows, and no more', async () => {
    await startRound('first-five')

    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('button', { name: degree(n) })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: degree(6) })).toBeNull()
    expect(screen.queryByRole('button', { name: degree(7) })).toBeNull()
  })

  it('hides the accidental keys on a level that stays in the key', async () => {
    await startRound('first-five')
    expect(screen.queryByRole('button', { name: 'Raise the next note' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lower the next note' })).toBeNull()
  })

  it('offers the accidental keys on a level that leaves it', async () => {
    await startRound('outside-the-key')
    expect(screen.getByRole('button', { name: 'Raise the next note' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lower the next note' })).toBeTruthy()
  })

  it('lets go of an accidental switch once a key has been pressed', async () => {
    // One-shot, like the dot and rest switches: it means the next key.
    await startRound('outside-the-key')

    const sharp = () => screen.getByRole('button', { name: 'Raise the next note' })
    fireEvent.click(sharp())
    expect(sharp().getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('music:degreeRaised', { degree: degree(1) }),
      }),
    )
    expect(sharp().getAttribute('aria-pressed')).toBe('false')
  })

  it('answers itself the moment the melody is as long as the one played', async () => {
    await startRound('first-five')

    // The level's melodies are three notes long, so the third press answers.
    for (let i = 0; i < 3; i += 1) {
      const keys = screen.queryAllByRole('button', { name: degree(1) })
      fireEvent.click(keys[0] as HTMLElement)
    }

    await waitFor(() =>
      expect(
        screen.queryByText('Correct') ?? screen.queryByRole('button', { name: /Next/ }),
      ).toBeTruthy(),
    )
  })

  it('takes a key back', async () => {
    await startRound('first-five')

    const back = () => screen.getByRole('button', { name: 'Delete the last one' })
    expect(back()).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: degree(1) }))
    expect(back()).toHaveProperty('disabled', false)

    fireEvent.click(back())
    expect(back()).toHaveProperty('disabled', true)
  })

  it('reaches its settings from Custom', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))

    expect(await screen.findByText('Degrees')).toBeTruthy()
    expect(screen.getByText('Melody length')).toBeTruthy()
    expect(screen.getByText('Outside the key')).toBeTruthy()
  })
})

describe('typing it instead', () => {
  const type = (key: string) => fireEvent.keyDown(window, { key })

  it('enters a degree from the number keys', async () => {
    // The number is already printed on the key, so the shortcut is the label.
    await startRound('first-five')

    type('1')
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('answers itself once enough have been typed', async () => {
    await startRound('first-five')

    // Three notes to this level's melodies, so the third keystroke answers.
    type('1')
    type('2')
    type('3')

    await waitFor(() =>
      expect(
        screen.queryByText('Correct') ?? screen.queryByRole('button', { name: /Next/ }),
      ).toBeTruthy(),
    )
  })

  it('ignores a number the level does not offer', async () => {
    await startRound('first-five')

    type('7')
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('takes one back on backspace', async () => {
    await startRound('first-five')

    type('1')
    const back = () => screen.getByRole('button', { name: 'Delete the last one' })
    expect(back()).toHaveProperty('disabled', false)

    type('Backspace')
    expect(back()).toHaveProperty('disabled', true)
  })

  it('raises and lowers with plus and minus', async () => {
    await startRound('outside-the-key')

    const sharp = () => screen.getByRole('button', { name: 'Raise the next note' })
    const flat = () => screen.getByRole('button', { name: 'Lower the next note' })

    type('+')
    expect(sharp().getAttribute('aria-pressed')).toBe('true')

    // The two are one choice, so asking for a flat lets go of the sharp.
    type('-')
    expect(sharp().getAttribute('aria-pressed')).toBe('false')
    expect(flat().getAttribute('aria-pressed')).toBe('true')

    // And pressing the same one again is how it is cancelled.
    type('-')
    expect(flat().getAttribute('aria-pressed')).toBe('false')
  })

  it('takes = for a sharp, which needs no shift', async () => {
    await startRound('outside-the-key')

    type('=')
    expect(
      screen
        .getByRole('button', { name: 'Raise the next note' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('lets go of the accidental once a number is typed', async () => {
    await startRound('outside-the-key')

    type('+')
    type('1')
    expect(
      screen
        .getByRole('button', { name: 'Raise the next note' })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('does nothing on a level that stays in the key', async () => {
    await startRound('first-five')

    type('+')
    // No switch exists to press, and nothing else may change either.
    expect(screen.queryByRole('button', { name: 'Raise the next note' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it("leaves the browser's own shortcuts alone", async () => {
    await startRound('first-five')

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })

    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      true,
    )
  })
})

describe('what the screens may say', () => {
  /**
   * The sibling of the rule the rhythm and scale suites enforce: a shared
   * screen may not name what only one exercise asks about. The prompt, the
   * replay control and the keyboard all come from `shared/`.
   */
  const FORBIDDEN = /\b(interval|rhythm|tuplet|triplet)\b/i

  it('never says interval or rhythm on the levels screen', async () => {
    const { container } = open()
    await screen.findByRole('heading', { name: 'Scale Degrees' })

    expect(container.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(container)).not.toMatch(FORBIDDEN)
  })

  it('never says interval or rhythm mid-round', async () => {
    await startRound('whole-scale')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    // An icon-only button says nothing in its text, so the accessible names
    // have to be read too.
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })

  it('never says interval or rhythm on its settings', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))
    await screen.findByText('Melody length')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })
})
