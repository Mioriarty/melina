import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import RhythmDictationExercise from './RhythmDictationExercise'

/**
 * Render smoke tests for Rhythmic Dictation.
 *
 * A clean typecheck is not evidence that an exercise runs: everything is wired
 * through a registry, a settings table and a generic round machine, and any of
 * those joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the drum kit are stubbed — one is 7 MB of WebAssembly and
 * the other wants an AudioContext jsdom does not have. Both are covered on
 * their own elsewhere.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const playRhythm = vi.fn(() => Promise.resolve())

vi.mock('@/lib/audio/engine', () => ({
  loadDrums: vi.fn(() => Promise.resolve({})),
  loadInstrument: vi.fn(() => Promise.resolve({})),
  playRhythm: (...args: unknown[]) => playRhythm(...(args as [])),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

function open() {
  return render(
    <MemoryRouter>
      <RhythmDictationExercise />
    </MemoryRouter>,
  )
}

const level = (id: string) => i18n.t(`levels:rhythm-dictation.${id}.title`)
const value = (id: string) => i18n.t(`music:noteValues.${id}`)

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

/** Press a note-value key by its spoken name. */
function press(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function startRound(id = 'quarters') {
  open()
  fireEvent.click(await screen.findByText(level(id)))
  return screen.findByRole('progressbar')
}

describe('Rhythmic Dictation', () => {
  it('lands on its levels, not on a settings form', async () => {
    open()

    expect(
      await screen.findByRole('heading', { name: 'Rhythmic Dictation' }),
    ).toBeTruthy()
    expect(screen.getByText(level('quarters'))).toBeTruthy()
    expect(screen.getByText(level('triplets'))).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('starts a round from a level, in the same tap', async () => {
    await startRound()
    expect(screen.getByText('Write the rhythm you hear')).toBeTruthy()
  })

  it('plays the question without being asked', async () => {
    playRhythm.mockClear()
    await startRound()
    await waitFor(() => expect(playRhythm).toHaveBeenCalled())
  })

  it('offers a keyboard of note values', async () => {
    await startRound()

    expect(screen.getByRole('button', { name: value('4.plain.note') })).toBeTruthy()
    expect(screen.getByRole('button', { name: value('1.plain.note') })).toBeTruthy()
  })

  it('offers rests as their own row rather than as a switch', async () => {
    // A rest is not a variation on the note before it, it is the other half of
    // writing a bar down — so it is a key, not two presses and a switch left on.
    await startRound()

    expect(screen.getByRole('button', { name: value('4.plain.note') })).toBeTruthy()
    expect(screen.getByRole('button', { name: value('4.plain.rest') })).toBeTruthy()
    expect(screen.getByRole('button', { name: value('16.plain.rest') })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Write rests instead of notes' }),
    ).toBeNull()
  })

  it('enters a rest in one press', async () => {
    await startRound()

    press(value('4.plain.rest'))
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('dots the values when asked, in both rows', async () => {
    // The dot really is a variation: it applies to whichever value comes next,
    // note or rest, so it multiplies the rows rather than adding to them.
    await startRound()

    fireEvent.click(screen.getByRole('button', { name: 'Dot the next value' }))
    expect(screen.getByRole('button', { name: value('4.dotted.note') })).toBeTruthy()
    expect(screen.getByRole('button', { name: value('4.dotted.rest') })).toBeTruthy()
  })

  it('lets go of the dot once a value has been entered', async () => {
    // It means "make *this* one dotted", not a mode to remember and turn back
    // off — and it lets go whichever row was used.
    await startRound()

    fireEvent.click(screen.getByRole('button', { name: 'Dot the next value' }))
    press(value('4.dotted.note'))
    expect(screen.getByRole('button', { name: value('4.plain.note') })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Dot the next value' }))
    press(value('8.dotted.rest'))
    expect(screen.getByRole('button', { name: value('8.plain.rest') })).toBeTruthy()
  })

  it('answers itself the moment the bar is full', async () => {
    await startRound()

    // Four quarters fills a bar of 4/4, and the fourth press is the answer.
    for (let i = 0; i < 3; i += 1) press(value('4.plain.note'))
    expect(screen.queryByText('Correct')).toBeNull()

    press(value('4.plain.note'))
    await waitFor(() =>
      expect(
        screen.queryByText('Correct') ?? screen.queryByRole('button', { name: /Next/ }),
      ).toBeTruthy(),
    )
  })

  it('will not let a value overflow the bar', async () => {
    await startRound()

    press(value('4.plain.note'))
    press(value('4.plain.note'))
    press(value('4.plain.note'))

    // One beat left: a whole note no longer fits, a quarter still does.
    expect(screen.getByRole('button', { name: value('1.plain.note') })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: value('4.plain.note') })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('takes a key back', async () => {
    await startRound()

    const back = () => screen.getByRole('button', { name: 'Delete the last one' })
    expect(back()).toHaveProperty('disabled', true)

    press(value('4.plain.note'))
    press(value('4.plain.note'))
    expect(back()).toHaveProperty('disabled', false)

    // Three quarters in, a whole note does not fit; take two back and it does.
    press(value('4.plain.note'))
    expect(screen.getByRole('button', { name: value('1.plain.note') })).toHaveProperty(
      'disabled',
      true,
    )

    fireEvent.click(back())
    fireEvent.click(back())
    fireEvent.click(back())
    expect(screen.getByRole('button', { name: value('1.plain.note') })).toHaveProperty(
      'disabled',
      false,
    )
    expect(back()).toHaveProperty('disabled', true)
  })

  it('offers a triplet switch only where the level has triplets', async () => {
    await startRound('triplets')
    expect(screen.getByRole('button', { name: 'Triplet' })).toBeTruthy()
  })

  it('has no triplet switch on a level without them', async () => {
    await startRound('quarters')
    expect(screen.queryByRole('button', { name: 'Triplet' })).toBeNull()
  })

  it('reaches its settings from Custom', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))

    expect(await screen.findByText('Subdivisions')).toBeTruthy()
    expect(screen.getByText('Time signatures')).toBeTruthy()
    expect(screen.getByText('The click')).toBeTruthy()
  })
})

describe('what the screens may say', () => {
  /**
   * The sibling of the rule `ScaleExercise.test.tsx` enforces: a shared screen
   * may not name what only one exercise asks about. The prompt, the play
   * control and the keyboard all come from `shared/`, and every one of them
   * used to be worded for pitch.
   */
  const FORBIDDEN = /\b(interval|scale|mode|clef|pitch)\b/i

  it('never says interval, scale or mode on the levels screen', async () => {
    const { container } = open()
    await screen.findByRole('heading', { name: 'Rhythmic Dictation' })

    expect(container.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(container)).not.toMatch(FORBIDDEN)
  })

  it('never says interval, scale or mode mid-round', async () => {
    open()
    fireEvent.click(await screen.findByText(level('sixteenths')))
    await screen.findByRole('progressbar')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    // An icon-only button says nothing in its text, so the accessible names
    // have to be read too.
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })

  it('never says interval, scale or mode on its settings', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))
    await screen.findByText('Subdivisions')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })
})
