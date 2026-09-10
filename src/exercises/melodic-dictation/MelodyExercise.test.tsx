import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import MelodicDictationExercise from './MelodicDictationExercise'

/**
 * Render smoke tests for Melodic Dictation.
 *
 * A clean typecheck is not evidence that an exercise runs: everything is wired
 * through a registry, a settings table and a generic round machine, and any of
 * those joins can be wrong in a way only mounting the thing reveals.
 *
 * The engraver and the instruments are stubbed — one is 7 MB of WebAssembly and
 * the others want an AudioContext jsdom does not have. Both are covered on
 * their own elsewhere.
 */
vi.mock('@/lib/notation/verovio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/notation/verovio')>()),
  preloadEngraver: () => undefined,
  renderMei: vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>')),
}))

const playMelody = vi.fn(() => Promise.resolve())

vi.mock('@/lib/audio/engine', () => ({
  loadDrums: vi.fn(() => Promise.resolve({})),
  loadInstrument: vi.fn(() => Promise.resolve({})),
  loadMelodyInstruments: vi.fn(() => Promise.resolve({})),
  playMelody: (...args: unknown[]) => playMelody(...(args as [])),
  stopPlayback: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}))

function open() {
  return render(
    <MemoryRouter>
      <MelodicDictationExercise />
    </MemoryRouter>,
  )
}

const level = (id: string) => i18n.t(`levels:melodic-dictation.${id}.title`)
const value = (id: string) => i18n.t(`music:noteValues.${id}`)
const degree = (id: string) => i18n.t(`music:degrees.${id}`)

/** Every accessible name on the screen, which visible text alone misses. */
function labels(container: HTMLElement): string {
  return [...container.querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .join(' | ')
}

/** Every switch in the keyboard: a button that is either on or off. */
function switches(): HTMLElement[] {
  return screen
    .queryAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') !== null)
}

/** The keys that enter a note, found by the degree names they carry. */
function noteKeys(): HTMLElement[] {
  const wanted = new Set([1, 2, 3, 4, 5, 6, 7].map((n) => degree(String(n))))
  return screen
    .queryAllByRole('button')
    .filter((button) => wanted.has(button.getAttribute('aria-label') ?? ''))
}

function press(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function startRound(id = 'beats-and-steps') {
  open()
  fireEvent.click(await screen.findByText(level(id)))
  return screen.findByRole('progressbar')
}

describe('Melodic Dictation', () => {
  it('lands on its levels, not on a settings form', async () => {
    open()

    expect(await screen.findByRole('heading', { name: 'Short Melodies' })).toBeTruthy()
    expect(screen.getByText(level('beats-and-steps'))).toBeTruthy()
    expect(screen.getByText(level('two-bars'))).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('starts a round from a level, in the same tap', async () => {
    await startRound()
    expect(screen.getByText('Write the melody you hear')).toBeTruthy()
  })

  it('plays the question without being asked', async () => {
    playMelody.mockClear()
    await startRound()
    await waitFor(() => expect(playMelody).toHaveBeenCalled())
  })

  it('offers a key per scale step in the level, and a rest', async () => {
    // The first level runs from the tonic to the fifth, so five notes and the
    // rest beside them.
    await startRound()

    expect(noteKeys()).toHaveLength(5)
    expect(screen.getByRole('button', { name: value('4.plain.rest') })).toBeTruthy()
    expect(screen.queryByRole('button', { name: degree('6') })).toBeNull()
  })

  it('names the key the melody is in', async () => {
    // A triad cannot tell E phrygian from E aeolian, so the key is stated
    // rather than played and the question is only the notes.
    await startRound()
    expect(document.body.textContent ?? '').toMatch(/major|minor/i)
  })

  it('gives the first note away, and will not let it be deleted', async () => {
    // Two bars, because a round is seeded from the clock: in a single bar the
    // given note can leave exactly one beat, and then the press below fills
    // the bar, answers the question and disables the whole keyboard for a
    // reason that has nothing to do with what is being tested.
    await startRound('two-bars')

    // Something is already written, so the staff is not empty — but backspace
    // has nothing to take, because what is written was not typed.
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      true,
    )

    press(degree('1'))
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      false,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete the last one' }))
    expect(screen.getByRole('button', { name: 'Delete the last one' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('keeps the note value armed between notes', async () => {
    // The one mode that stays down. A melody is mostly one value at a time, so
    // a value that let go after every note would double the work.
    //
    // Checked with a sixteenth rather than a half, because a sixteenth fits
    // wherever there is any room at all: a half would sometimes stop fitting
    // after the note was entered, and the row would then be showing the
    // fallback rather than failing to be sticky. That case is its own test.
    await startRound()

    const short = () => screen.getByRole('button', { name: value('16.plain.note') })
    expect(short().getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(short())
    expect(short().getAttribute('aria-pressed')).toBe('true')

    press(degree('1'))
    // Still a sixteenth after entering one, unlike the dot.
    expect(short().getAttribute('aria-pressed')).toBe('true')
  })

  it('falls back to a value that fits rather than going dead', async () => {
    // Three beats into a bar of four with a half note armed, nothing on the
    // bottom row could be pressed. Instead the largest value that does fit is
    // used, so there is always something to press and the bar can be finished.
    await startRound()

    // Fill the bar with sixteenths until fewer than two beats are left, which
    // is where a half note stops fitting.
    fireEvent.click(screen.getByRole('button', { name: value('16.plain.note') }))
    for (let i = 0; i < 16; i += 1) {
      const key = screen.queryByRole('button', { name: value('2.plain.note') })
      if (key !== null && (key as HTMLButtonElement).disabled) break
      const note = screen.getByRole('button', { name: degree('1') })
      if ((note as HTMLButtonElement).disabled) break
      fireEvent.click(note)
    }

    const half = screen.getByRole('button', { name: value('2.plain.note') })
    expect(half).toHaveProperty('disabled', true)

    // A half is out of reach, and the note keys are still live because the
    // armed value fell back to one that fits.
    expect(screen.getByRole('button', { name: degree('1') })).toHaveProperty(
      'disabled',
      false,
    )
    expect(
      switches().some(
        (button) =>
          button.getAttribute('aria-pressed') === 'true' &&
          !(button as HTMLButtonElement).disabled,
      ),
    ).toBe(true)
  })

  it('lets go of the dot once a note has been entered', async () => {
    // Two bars, so there is certainly room for a dotted value: a round is
    // seeded from the clock, and in a single bar the given first note can
    // leave too little of it for the dot to be armable at all.
    await startRound('two-bars')

    const dot = () => screen.getByRole('button', { name: 'Dot the next value' })
    expect(dot().getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(dot())
    expect(dot().getAttribute('aria-pressed')).toBe('true')
    // And the keys preview what pressing one would now write.
    expect(screen.getByRole('button', { name: value('4.dotted.rest') })).toBeTruthy()

    press(degree('1'))
    // It meant "make *this* one dotted", not a mode to remember and turn off.
    expect(dot().getAttribute('aria-pressed')).toBe('false')
  })

  it('has no accidental switches on a level that stays in the key', async () => {
    await startRound('beats-and-steps')
    expect(screen.queryByRole('button', { name: 'Raise the next note' })).toBeNull()
    // The dot, and the five note values. Nothing else is on or off.
    expect(switches()).toHaveLength(6)
  })

  it('offers the accidentals on a level that leaves the key', async () => {
    await startRound('outside-the-key')
    expect(screen.getByRole('button', { name: 'Raise the next note' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lower the next note' })).toBeTruthy()
  })

  it('offers a triplet switch only where the level has triplets', async () => {
    await startRound('triplets')
    expect(screen.getByRole('button', { name: 'Triplet' })).toBeTruthy()
  })

  it('has no triplet switch on a level without them', async () => {
    await startRound('beats-and-steps')
    expect(screen.queryByRole('button', { name: 'Triplet' })).toBeNull()
  })

  it('will not let a value overflow the bar', async () => {
    await startRound()

    // A whole note cannot fit: the given first note has already taken part of
    // the bar, whatever it was.
    expect(screen.getByRole('button', { name: value('1.plain.note') })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('reaches every step of a range that crosses the octave', async () => {
    // Two keys read "1" — the tonic and the octave above it — which is the
    // whole reason a key carries a mark as well as a number.
    await startRound('the-octave')

    expect(noteKeys()).toHaveLength(7)
    expect(
      screen.getByRole('button', { name: `${degree('1')}, an octave above` }),
    ).toBeTruthy()
  })

  it('answers itself the moment the last bar is full', async () => {
    await startRound()

    // Fill whatever is left with sixteenths; one of them completes the bar and
    // that press is the answer. Nothing here has to know how much the given
    // note took.
    for (let i = 0; i < 16; i += 1) {
      const key = screen.queryByRole('button', { name: degree('1') })
      if (key === null || (key as HTMLButtonElement).disabled) break
      fireEvent.click(screen.getByRole('button', { name: value('16.plain.note') }))
      fireEvent.click(key)
    }

    await waitFor(() =>
      expect(
        screen.queryByText('Correct') ?? screen.queryByRole('button', { name: /Next/ }),
      ).toBeTruthy(),
    )
  })

  it('reaches its settings from Custom', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))

    expect(await screen.findByText('Range')).toBeTruthy()
    expect(screen.getByText('Subdivisions')).toBeTruthy()
    expect(screen.getByText('Bars')).toBeTruthy()
  })
})

describe('what the screens may say', () => {
  /**
   * The sibling of the rule `ScaleExercise.test.tsx` enforces: a shared screen
   * may not name what only one exercise asks about. Melodic dictation is the
   * first exercise that asks about pitch *and* rhythm, so the word it must not
   * borrow is narrower — an interval and a scale are still other exercises.
   */
  const FORBIDDEN = /\b(interval|chord)\b/i

  it('never says interval or chord on the levels screen', async () => {
    const { container } = open()
    await screen.findByRole('heading', { name: 'Short Melodies' })

    expect(container.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(container)).not.toMatch(FORBIDDEN)
  })

  it('never says interval or chord mid-round', async () => {
    open()
    fireEvent.click(await screen.findByText(level('sixteenths')))
    await screen.findByRole('progressbar')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    // An icon-only button says nothing in its text, so the accessible names
    // have to be read too.
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })

  it('never says interval or chord on its settings', async () => {
    open()
    fireEvent.click(await screen.findByText('Custom'))
    await screen.findByText('Range')

    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN)
    expect(labels(document.body)).not.toMatch(FORBIDDEN)
  })
})
